import type {
  OfflineCaptureLeasePageV3,
} from '@taptime/offline-sync-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(),
}));

import { MobileSessionCoordinator } from '../../src/auth/MobileSessionCoordinator';
import type {
  BackendSessionPort,
  BackendSessionResolution,
  ProductSessionContext,
  ProviderAuthEvent,
  ProviderAuthPort,
  ProviderRefreshResult,
  RefreshTokenStore,
} from '../../src/auth/contracts';
import { AndroidMonotonicClock } from '../../src/offline/AndroidMonotonicClock';
import {
  OfflineCaptureCoordinator,
  type OfflineCaptureSessionReader,
} from '../../src/offline/OfflineCaptureCoordinator';
import { OfflineCaptureDatabase } from '../../src/offline/OfflineCaptureDatabase';
import { OfflineCaptureLeaseClient } from '../../src/offline/OfflineCaptureLeaseClient';
import {
  OfflineInstallationIdentityStore,
  type OfflineSecureStorePort,
} from '../../src/offline/OfflineInstallationIdentityStore';
import { mobileManifestDigestV3 } from '../../src/offline/MobileLookupHmac';
import { OfflineSyncScheduler } from '../../src/offline/OfflineSyncScheduler';
import {
  DefaultProductMobileRuntime,
} from '../../src/runtime/DefaultProductMobileRuntime';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';
import type { ProductServerTransport } from '../../src/transport/contracts';
import {
  MemoryOfflineDatabase,
  memorySecureStore,
} from '../support/MemoryOfflinePlatform';

import { canPresentOfflineCaptureShell } from '../../src/navigation/offlineCaptureShell';

const ids = {
  organization: '00000000-0000-4000-8000-000000000051',
  employee: '10000000-0000-4000-8000-000000000051',
  differentEmployee: '10000000-0000-4000-8000-000000000052',
  membership: '20000000-0000-4000-8000-000000000051',
  differentMembership: '20000000-0000-4000-8000-000000000052',
  identityBinding: '30000000-0000-4000-8000-000000000051',
  installation: '40000000-0000-4000-8000-000000000051',
  lease: '50000000-0000-4000-8000-000000000051',
  item: '60000000-0000-4000-8000-000000000051',
  assignment: '70000000-0000-4000-8000-000000000051',
  tag: '80000000-0000-4000-8000-000000000051',
  customer: '90000000-0000-4000-8000-000000000051',
  command: 'a0000000-0000-4000-8000-000000000051',
} as const;

const issuedAt = '2026-08-13T08:00:00.000Z';
const expiresAt = '2026-08-13T20:00:00.000Z';
const wallClock = Date.parse(issuedAt);

describe('Product Mobile runtime Employee readiness', () => {
  it('T-065 restores the actual offline capture shell within three seconds while auth hangs, then promotes only after confirmation', async () => {
    const secureStore = memorySecureStore();
    const database = new MemoryOfflineDatabase();
    const first = productRuntimeHarness(session(ids.employee, ids.membership), secureStore.port, database);
    await first.runtime.start();
    await first.runtime.session.signIn('ignored@example.invalid', 'password');
    await vi.waitFor(() => expect(first.runtime.scan.getState().status).toBe('ready'));
    first.runtime.stop();
    await vi.waitFor(() => expect(database.closed).toBe(true));
    const provider = new MemoryProvider();
    let confirm!: (result: ProviderRefreshResult) => void;
    provider.refreshImplementation = () => new Promise(resolve => { confirm = resolve; });
    let confirmBackend!: (value: BackendSessionResolution) => void;
    const resolveBackend = vi.fn(() => new Promise<BackendSessionResolution>(resolve => { confirmBackend = resolve; }));
    const cold = productRuntimeHarness(session(ids.employee, ids.membership), secureStore.port, database,
      () => {}, { provider, store: first.store, resolveBackend });
    const startedAt = performance.now();
    let visibleAt: number | null = null;
    cold.runtime.scan.subscribe(() => {
      if (visibleAt === null && canPresentOfflineCaptureShell(cold.runtime.session.getState(), cold.runtime.scan.getState())) {
        visibleAt = performance.now() - startedAt;
      }
    });
    try {
      await cold.runtime.start();
      await vi.waitFor(() => expect(canPresentOfflineCaptureShell(cold.runtime.session.getState(), cold.runtime.scan.getState())).toBe(true));
      console.info('T-065 actual capture runtime:', JSON.stringify({ offlineShellMilliseconds: Math.round(visibleAt!) }));
      expect(visibleAt).not.toBeNull();
      expect(visibleAt!).toBeLessThanOrEqual(3000);
      expect(cold.runtime.session.getState()).toEqual({ status: 'context_unavailable', identityLabel: 'server@example.invalid' });
      expect(cold.sessionCoordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
      expect(cold.leaseRequests.paths).toEqual([]);
      confirm({ status: 'refreshed', tokens: { accessToken: 'restored-access', refreshToken: 'restored-refresh',
        identity: { providerUserId: 'provider-user', email: 'server@example.invalid' } } });
      await vi.waitFor(() => expect(resolveBackend).toHaveBeenCalled());
      // Provider has answered, product backend has not: the real offline target path still works.
      await expect(cold.scanCoordinator.readOfflineManualTargets()).resolves.toMatchObject({ status: 'ready' });
      expect(cold.sessionCoordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
      confirmBackend({ status: 'resolved', session: session(ids.employee, ids.membership) });
      await vi.waitFor(() => expect(cold.runtime.session.getState().status).toBe('authenticated'));
      await vi.waitFor(() => expect(cold.runtime.scan.getState().status).toBe('ready'));
      expect(cold.sessionCoordinator.captureAuthenticatedSessionSnapshot()).not.toBeNull();
    } finally { cold.runtime.stop(); }
  });

  it('reopens protected infrastructure on login without rewriting the retained owner or leases', async () => {
    const secureStore = memorySecureStore();
    const database = new MemoryOfflineDatabase();
    const first = productRuntimeHarness(session(ids.employee, ids.membership), secureStore.port, database);
    await first.runtime.start();
    await first.runtime.session.signIn('first@example.invalid', 'password');
    await vi.waitFor(() => expect(first.runtime.scan.getState().status).toBe('ready'));
    first.runtime.stop();
    await vi.waitFor(() => expect(database.closed).toBe(true));
    const owner = structuredClone(database.owner);
    const leases = structuredClone(database.leases);
    let opens = 0;
    const next = productRuntimeHarness(session(ids.employee, ids.membership),
      secureStore.port, database, () => { if (++opens === 1) throw new Error('transient open failure'); });
    try {
      await next.runtime.start();
      expect(next.runtime.scan.getState()).toMatchObject({ status: 'protected_pending', reason: 'local_evidence_protected' });
      await next.runtime.session.signIn('second@example.invalid', 'password');
      await vi.waitFor(() => expect(next.runtime.scan.getState()).toEqual({ status: 'ready', outcome: null }));
      expect(opens).toBeGreaterThan(1);
      expect(database.owner).toEqual(owner);
      expect(database.leases).toEqual(leases);
    } finally { next.runtime.stop(); }
  });

  it('starts empty infrastructure before login, activates an exact v3 Employee lease, and protects a retained different owner',
    async () => {
      const secureStore = memorySecureStore();
      const nativeDatabase = new MemoryOfflineDatabase();
      const employeeSession = session(ids.employee, ids.membership);
      const first = productRuntimeHarness(
        employeeSession,
        secureStore.port,
        nativeDatabase,
      );
      const timeline: string[] = [];
      first.runtime.scan.subscribe(() => timeline.push(first.runtime.scan.getState().status));

      await first.runtime.start();
      expect(first.runtime.session.getState()).toEqual({
        status: 'unauthenticated',
        reason: 'not_signed_in',
      });
      expect(first.runtime.scan.getState()).toEqual({ status: 'inactive' });
      expect(secureStore.values.size).toBe(4);

      await expect(first.runtime.session.signIn(
        'employee@example.invalid',
        'exact-password',
      )).resolves.toEqual({ status: 'authenticated' });
      await vi.waitFor(() => {
        expect(first.runtime.scan.getState()).toEqual({ status: 'ready', outcome: null });
      });

      expect(readinessTimeline(timeline)).toEqual([
        'checking',
        'checking',
        'ready',
        'ready',
      ]);
      expect(timeline).not.toContain('protected_pending');
      expect(timeline).not.toContain('secure_storage_unavailable');
      expect(timeline).not.toContain('unavailable');
      expect(nativeDatabase.owner).toMatchObject({
        organization_id: ids.organization,
        user_id: ids.employee,
        membership_id: ids.membership,
        installation_id: ids.installation,
        identity_binding_id: ids.identityBinding,
        capture_invalidated: 0,
      });
      expect(nativeDatabase.leases).toEqual([
        expect.objectContaining({
          leaseId: ids.lease,
          organizationId: ids.organization,
          userId: ids.employee,
          membershipId: ids.membership,
          role: 'employee',
          state: 'active',
        }),
      ]);
      expect(first.leaseRequests.paths).toEqual(['/v3/offline-capture-leases']);

      first.runtime.stop();
      await vi.waitFor(() => expect(nativeDatabase.closed).toBe(true));

      const different = productRuntimeHarness(
        session(ids.differentEmployee, ids.differentMembership),
        secureStore.port,
        nativeDatabase,
      );
      await different.runtime.start();
      await expect(different.runtime.session.signIn(
        'different@example.invalid',
        'different-password',
      )).resolves.toEqual({ status: 'authenticated' });
      await vi.waitFor(() => {
        expect(different.runtime.scan.getState()).toEqual({
          status: 'protected_pending',
          reason: 'identity_mismatch',
        });
        expect(different.runtime.scan.getState().protection).toEqual(['P06']);
      });
      expect(different.leaseRequests.paths).toEqual([]);
      expect(nativeDatabase.owner).toMatchObject({
        user_id: ids.employee,
        membership_id: ids.membership,
      });
      different.runtime.stop();
    });
});

function productRuntimeHarness(
  productSession: ProductSessionContext,
  secureStore: OfflineSecureStorePort,
  nativeDatabase: MemoryOfflineDatabase,
  beforeDatabaseOpen: () => void = () => {},
  auth?: { provider: MemoryProvider; store: MemoryRefreshTokenStore; resolveBackend?: () => Promise<BackendSessionResolution> },
) {
  const provider = auth?.provider ?? new MemoryProvider();
  const store = auth?.store ?? new MemoryRefreshTokenStore();
  const sessionCoordinator = new MobileSessionCoordinator(
    provider,
    store,
    {
      async resolve() {
        return auth?.resolveBackend ? auth.resolveBackend() : { status: 'resolved' as const, session: productSession };
      },
      async recordPasswordReset() { return { status: 'unavailable' as const }; },
    } satisfies BackendSessionPort,
  );
  const sessionReader: OfflineCaptureSessionReader = {
    capture: () => sessionCoordinator.captureAuthenticatedSessionSnapshot(),
    isCurrent: (snapshot) => sessionCoordinator.isAuthenticatedSessionSnapshotCurrent(snapshot),
    subscribe: (listener) => sessionCoordinator.subscribe(listener),
    getState: () => sessionCoordinator.getState(),
    isOfflineCaptureRestorationAllowed: () => (
      sessionCoordinator.isOfflineCaptureRestorationAllowed()
    ),
    captureOfflineRestorationSnapshot: () => (
      sessionCoordinator.captureOfflineRestorationSnapshot()
    ),
    isOfflineRestorationSnapshotCurrent: (snapshot) => (
      sessionCoordinator.isOfflineRestorationSnapshotCurrent(snapshot)
    ),
    retryContext: () => sessionCoordinator.retryContext(),
  };
  let randomSeed = 0;
  const identityStore = new OfflineInstallationIdentityStore(
    secureStore,
    async (length) => {
      const start = randomSeed;
      randomSeed += length;
      return Uint8Array.from(
        { length },
        (_, index) => (start + index + 1) & 0xff,
      );
    },
  );
  const leaseRequests = new V2LeaseRequest(productSession);
  const databaseFactory = (key: Uint8Array) => new OfflineCaptureDatabase(async () => {
    beforeDatabaseOpen();
    nativeDatabase.closed = false;
    return nativeDatabase;
  }, key);
  const clock = new AndroidMonotonicClock({
    async sample() {
      return {
        bootMarker: 'boot-product-runtime',
        elapsedRealtimeMilliseconds: 10_000,
        wallClockMilliseconds: wallClock,
      };
    },
  });
  const legacyLifecycle = {
    async ingest() { return { status: 'transient_failure' as const }; },
  };
  const offlineLifecycle = {
    async ingest() { return { status: 'unavailable' as const }; },
    async reconcile() { return { status: 'unavailable' as const }; },
    async readReviewState() { return { status: 'unavailable' as const }; },
  };
  const scan = new OfflineCaptureCoordinator(
    { async scan() { return { status: 'unavailable' }; } },
    {
      async checkCapability() { return 'ready'; },
      async cancelCapture() {},
      async stop() {},
    },
    sessionReader,
    identityStore,
    databaseFactory,
    new OfflineCaptureLeaseClient(new URL('https://api.example/'), leaseRequests),
    clock,
    (database, authorityRejection) => new OfflineSyncScheduler(
      database,
      offlineLifecycle,
      legacyLifecycle,
      authorityRejection,
    ),
    {
      async read() { return null; },
      async write() {},
      async clear() {},
    },
    () => ids.command,
    { bind() {} },
    () => new Date(wallClock),
  );
  const runtime = new DefaultProductMobileRuntime(
    sessionCoordinator,
    { start() {}, stop() {} },
    {} as ProductServerTransport,
    scan,
    {
      getState: () => ({ status: 'inactive' }),
      subscribe: () => () => undefined,
      async refresh() {},
      async loadMore() {},
      async provision() {},
      async provisionBreak() {},
      async cancel() {},
      async start() {},
      async stop() {},
    },
  );
  return { leaseRequests, runtime, store, sessionCoordinator, scanCoordinator: scan };
}

class MemoryProvider implements ProviderAuthPort {
  private readonly listeners = new Set<(event: ProviderAuthEvent) => void>();

  async signInWithPassword() {
    return {
      status: 'authenticated' as const,
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token',
        identity: { providerUserId: 'provider-user', email: 'server@example.invalid' } },
    };
  }

  refreshImplementation: () => Promise<ProviderRefreshResult> = async () => ({ status: 'rejected' });
  async refreshSession() { return this.refreshImplementation(); }

  async signOutLocal() {}

  subscribe(listener: (event: ProviderAuthEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startAutoRefresh() {}
  async stopAutoRefresh() {}
}

class MemoryRefreshTokenStore implements RefreshTokenStore {
  identity: import('../../src/auth/contracts').ConfirmedSessionIdentity | null = null;
  async readIdentity() { return this.identity; }
  async writeIdentity(identity: import('../../src/auth/contracts').ConfirmedSessionIdentity | null) { this.identity = identity; }

  private value: string | null = null;
  async isAvailable() { return true; }
  async read() { return this.value; }
  async write(value: string) { this.value = value; }
  async clear() { this.value = null; this.identity = null; }
}

class V2LeaseRequest implements AuthenticatedJsonPostPort {
  readonly paths: string[] = [];

  constructor(private readonly productSession: ProductSessionContext) {}

  async post(endpoint: URL): Promise<AuthenticatedHttpResult> {
    this.paths.push(endpoint.pathname);
    return {
      status: 'response',
      statusCode: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        idempotentRetry: false,
        page: leasePage(this.productSession),
      }),
    };
  }
}

function leasePage(productSession: ProductSessionContext): OfflineCaptureLeasePageV3 {
  if (productSession.role === 'standortleitung') throw new Error('This fixture covers employee/admin lease roles.');
  const items = [{
    itemType: 'nfc_assignment' as const,
    subjectType: 'work' as const,
    itemId: ids.item,
    lookup: '1'.repeat(64),
    assignmentId: ids.assignment,
    nfcTagId: ids.tag,
    targetType: 'customer' as const,
    targetId: ids.customer,
    displayName: 'Kunde',
    assignmentRowVersion: 1,
    targetRowVersion: 1,
  }];
  return {
    leaseSchemaVersion: 3,
    manifestVersion: 3,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identityBinding,
    userId: productSession.userId,
    organizationId: productSession.organizationId,
    membershipId: productSession.membershipId,
    membershipRowVersion: 1,
    role: productSession.role,
    issuedAt,
    expiresAt,
    configurationRevision: '2'.repeat(64),
    itemCount: items.length,
    serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
    manifestDigest: mobileManifestDigestV3(items),
    items,
    nextCursor: null,
  };
}

function session(userId: string, membershipId: string): ProductSessionContext {
  return {
    userId,
    membershipId,
    organizationId: ids.organization,
    role: 'employee',
    nfcSetupAvailable: false,
  };
}

function readinessTimeline(timeline: readonly string[]): readonly string[] {
  return timeline.filter((status) => (
    status === 'checking'
    || status === 'ready'
    || status === 'protected_pending'
    || status === 'secure_storage_unavailable'
    || status === 'unavailable'
  ));
}
