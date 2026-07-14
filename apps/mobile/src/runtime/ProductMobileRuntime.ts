import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { createTimestamp } from '@taptime/core';
import { ExpoRefreshTokenStore } from '../auth/ExpoRefreshTokenStore';
import { MobileSessionCoordinator } from '../auth/MobileSessionCoordinator';
import { createSupabaseEmailPasswordAuthAdapter } from '../auth/SupabaseEmailPasswordAuthAdapter';
import { TapTimeSessionApiClient } from '../auth/TapTimeSessionApiClient';
import { RnNfcScanAdapter } from '../nfc/RnNfcScanAdapter';
import { ExpoSecureLifecycleEvidenceOutbox } from '../scan/ExpoSecureLifecycleEvidenceOutbox';
import { ProductScanOrchestrator } from '../scan/ProductScanOrchestrator';
import type {
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
} from '../scan/contracts';
import { AuthenticatedHttpRequestExecutor } from '../transport/AuthenticatedHttpRequestExecutor';
import { TapTimeLifecycleApiClient } from '../transport/TapTimeLifecycleApiClient';
import { TapTimeScanContextApiClient } from '../transport/TapTimeScanContextApiClient';
import type { ProductServerTransport } from '../transport/contracts';
import { createNativeAppStateAutoRefreshLifecycle } from './AppStateAutoRefreshLifecycle';
import {
  readProductRuntimeEnvironment,
  validateProductRuntimeConfiguration,
} from './runtimeConfiguration';
import {
  DefaultProductMobileRuntime,
  type ProductMobileRuntime,
} from './DefaultProductMobileRuntime';

export type { ProductMobileRuntime } from './DefaultProductMobileRuntime';

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
    new ExpoSecureLifecycleEvidenceOutbox(),
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
