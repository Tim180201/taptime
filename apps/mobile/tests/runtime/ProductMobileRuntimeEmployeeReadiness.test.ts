import type {
  OfflineCaptureLeasePageV2,
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
  ProductSessionContext,
  ProviderAuthEvent,
  ProviderAuthPort,
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
import { mobileManifestDigestV2 } from '../../src/offline/MobileLookupHmac';
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
  it('starts empty infrastructure before login, activates an exact v2 Employee lease, and protects a retained different owner',
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
      expect(first.leaseRequests.paths).toEqual(['/v2/offline-capture-leases']);

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
) {
  const provider = new MemoryProvider();
  const sessionCoordinator = new MobileSessionCoordinator(
    provider,
    new MemoryRefreshTokenStore(),
    {
      async resolve() {
        return { status: 'resolved' as const, session: productSession };
      },
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
      async cancel() {},
      async start() {},
      async stop() {},
    },
  );
  return { leaseRequests, runtime };
}

class MemoryProvider implements ProviderAuthPort {
  private readonly listeners = new Set<(event: ProviderAuthEvent) => void>();

  async signInWithPassword() {
    return {
      status: 'authenticated' as const,
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    };
  }

  async refreshSession() {
    return { status: 'rejected' as const };
  }

  async signOutLocal() {}

  subscribe(listener: (event: ProviderAuthEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startAutoRefresh() {}
  async stopAutoRefresh() {}
}

class MemoryRefreshTokenStore implements RefreshTokenStore {
  private value: string | null = null;
  async isAvailable() { return true; }
  async read() { return this.value; }
  async write(value: string) { this.value = value; }
  async clear() { this.value = null; }
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

function leasePage(productSession: ProductSessionContext): OfflineCaptureLeasePageV2 {
  const items = [{
    itemType: 'nfc_assignment' as const,
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
    leaseSchemaVersion: 2,
    manifestVersion: 2,
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
    manifestDigest: mobileManifestDigestV2(items),
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
