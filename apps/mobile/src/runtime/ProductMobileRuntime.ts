import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { createTimestamp } from '@taptime/core';
import { ExpoRefreshTokenStore } from '../auth/ExpoRefreshTokenStore';
import { MobileSessionCoordinator } from '../auth/MobileSessionCoordinator';
import { createSupabaseEmailPasswordAuthAdapter } from '../auth/SupabaseEmailPasswordAuthAdapter';
import { TapTimeSessionApiClient } from '../auth/TapTimeSessionApiClient';
import type { MobileSessionCapability } from '../auth/contracts';
import { RnNfcScanAdapter } from '../nfc/RnNfcScanAdapter';
import { ProductScanOrchestrator } from '../scan/ProductScanOrchestrator';
import type {
  ProductScanCapability,
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
} from '../scan/contracts';
import { AuthenticatedHttpRequestExecutor } from '../transport/AuthenticatedHttpRequestExecutor';
import { TapTimeLifecycleApiClient } from '../transport/TapTimeLifecycleApiClient';
import { TapTimeScanContextApiClient } from '../transport/TapTimeScanContextApiClient';
import type { ProductServerTransport } from '../transport/contracts';
import {
  createNativeAppStateAutoRefreshLifecycle,
  type AppStateAutoRefreshLifecycle,
} from './AppStateAutoRefreshLifecycle';
import {
  readProductRuntimeEnvironment,
  validateProductRuntimeConfiguration,
} from './runtimeConfiguration';

export interface ProductMobileRuntime {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  start(): Promise<void>;
  stop(): void;
}

export type ProductMobileRuntimeCreation =
  | { readonly status: 'ready'; readonly runtime: ProductMobileRuntime }
  | { readonly status: 'unavailable' };

export function createProductMobileRuntime(): ProductMobileRuntimeCreation {
  const configuration = validateProductRuntimeConfiguration(
    readProductRuntimeEnvironment(),
    Platform.OS,
  );
  if (configuration.status === 'invalid') {
    return { status: 'unavailable' };
  }

  const provider = createSupabaseEmailPasswordAuthAdapter(
    configuration.configuration.supabaseUrl,
    configuration.configuration.supabasePublishableKey,
  );
  const coordinator = new MobileSessionCoordinator(
    provider,
    new ExpoRefreshTokenStore(),
    new TapTimeSessionApiClient(configuration.configuration.tapTimeApiBaseUrl),
  );
  const appStateLifecycle = createNativeAppStateAutoRefreshLifecycle(provider);
  // Expo's native fetch exposes a real ReadableStream, allowing the transport to stop oversized
  // responses before they are buffered in full by React Native's legacy fetch polyfill.
  const authenticatedRequests = new AuthenticatedHttpRequestExecutor(coordinator, expoFetch);
  const serverTransport: ProductServerTransport = Object.freeze({
    scanContext: new TapTimeScanContextApiClient(
      configuration.configuration.tapTimeApiBaseUrl,
      authenticatedRequests,
    ),
    lifecycle: new TapTimeLifecycleApiClient(
      configuration.configuration.tapTimeApiBaseUrl,
      authenticatedRequests,
    ),
  });
  const scanSessionContext: ProductScanSessionContextReader = Object.freeze({
    capture: () => coordinator.captureAuthenticatedSessionSnapshot(),
    isCurrent: (snapshot: ProductScanSessionSnapshot) => (
      coordinator.isAuthenticatedSessionSnapshotCurrent(snapshot)
    ),
    subscribe: (listener: () => void) => coordinator.subscribe(listener),
  });
  const nfcAdapter = new RnNfcScanAdapter({
    platform: Platform.OS,
    captureTimestamp: () => createTimestamp(new Date().toISOString()),
  });
  const scanOrchestrator = new ProductScanOrchestrator(
    nfcAdapter,
    nfcAdapter,
    serverTransport.scanContext,
    serverTransport.lifecycle,
    scanSessionContext,
    randomUUID,
  );
  return {
    status: 'ready',
    runtime: new DefaultProductMobileRuntime(
      coordinator,
      appStateLifecycle,
      serverTransport,
      scanOrchestrator,
    ),
  };
}

class DefaultProductMobileRuntime implements ProductMobileRuntime {
  private started = false;
  private readonly sessionCapability: MobileSessionCapability;
  private readonly scanCapability: ProductScanCapability;

  constructor(
    private readonly coordinator: MobileSessionCoordinator,
    private readonly appStateLifecycle: AppStateAutoRefreshLifecycle,
    // C2 composes these private clients for later orchestrators without exposing them to React.
    private readonly serverTransport: ProductServerTransport,
    private readonly scanOrchestrator: ProductScanOrchestrator,
  ) {
    // React receives a real narrow facade, not the coordinator object that owns C2 token access.
    this.sessionCapability = Object.freeze({
      getState: () => this.coordinator.getState(),
      subscribe: (listener: () => void) => this.coordinator.subscribe(listener),
      signIn: (email: string, password: string) => this.coordinator.signIn(email, password),
      retryContext: () => this.coordinator.retryContext(),
      refresh: () => this.coordinator.refresh(),
      signOut: () => this.coordinator.signOut(),
    });
    // React receives state/actions only: no native manager, C2 client, token or raw UID.
    this.scanCapability = Object.freeze({
      getState: () => this.scanOrchestrator.getState(),
      subscribe: (listener: () => void) => this.scanOrchestrator.subscribe(listener),
      scan: () => this.scanOrchestrator.scan(),
      cancel: () => this.scanOrchestrator.cancel(),
      retry: () => this.scanOrchestrator.retry(),
    });
  }

  get session(): MobileSessionCapability {
    return this.sessionCapability;
  }

  get scan(): ProductScanCapability {
    return this.scanCapability;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    // Keep the private capability graph owned for the complete product-runtime lifetime.
    void this.serverTransport;
    await this.scanOrchestrator.start();
    await this.coordinator.start();
    this.appStateLifecycle.start();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.appStateLifecycle.stop();
    void this.scanOrchestrator.stop();
    this.coordinator.stop();
  }
}
