import { Platform } from 'react-native';
import { ExpoRefreshTokenStore } from '../auth/ExpoRefreshTokenStore';
import { MobileSessionCoordinator } from '../auth/MobileSessionCoordinator';
import { createSupabaseEmailPasswordAuthAdapter } from '../auth/SupabaseEmailPasswordAuthAdapter';
import { TapTimeSessionApiClient } from '../auth/TapTimeSessionApiClient';
import type { MobileSessionCapability } from '../auth/contracts';
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
  return {
    status: 'ready',
    runtime: new DefaultProductMobileRuntime(coordinator, appStateLifecycle),
  };
}

class DefaultProductMobileRuntime implements ProductMobileRuntime {
  private started = false;

  constructor(
    private readonly coordinator: MobileSessionCoordinator,
    private readonly appStateLifecycle: AppStateAutoRefreshLifecycle,
  ) {}

  get session(): MobileSessionCapability {
    return this.coordinator;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
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
