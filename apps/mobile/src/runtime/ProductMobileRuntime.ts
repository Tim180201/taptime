import { Platform } from 'react-native';
import { ExpoRefreshTokenStore } from '../auth/ExpoRefreshTokenStore';
import { MobileSessionCoordinator } from '../auth/MobileSessionCoordinator';
import { createSupabaseEmailPasswordAuthAdapter } from '../auth/SupabaseEmailPasswordAuthAdapter';
import { TapTimeSessionApiClient } from '../auth/TapTimeSessionApiClient';
import type { MobileSessionCapability } from '../auth/contracts';
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
  const authenticatedRequests = new AuthenticatedHttpRequestExecutor(coordinator);
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
  return {
    status: 'ready',
    runtime: new DefaultProductMobileRuntime(coordinator, appStateLifecycle, serverTransport),
  };
}

class DefaultProductMobileRuntime implements ProductMobileRuntime {
  private started = false;
  private readonly sessionCapability: MobileSessionCapability;

  constructor(
    private readonly coordinator: MobileSessionCoordinator,
    private readonly appStateLifecycle: AppStateAutoRefreshLifecycle,
    // C2 composes these private clients for later orchestrators without exposing them to React.
    private readonly serverTransport: ProductServerTransport,
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
  }

  get session(): MobileSessionCapability {
    return this.sessionCapability;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    // Keep the private capability graph owned for the complete product-runtime lifetime.
    void this.serverTransport;
    await this.coordinator.start();
    this.appStateLifecycle.start();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.appStateLifecycle.stop();
    this.coordinator.stop();
  }
}
