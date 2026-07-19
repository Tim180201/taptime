import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { createTimestamp } from '@taptime/core';
import { ExpoRefreshTokenStore } from '../auth/ExpoRefreshTokenStore';
import { AdminSetupCoordinator } from '../administration/AdminSetupCoordinator';
import { TapTimeAdministrationApiClient } from '../administration/TapTimeAdministrationApiClient';
import { MobileSessionCoordinator } from '../auth/MobileSessionCoordinator';
import { createSupabaseEmailPasswordAuthAdapter } from '../auth/SupabaseEmailPasswordAuthAdapter';
import { TapTimeSessionApiClient } from '../auth/TapTimeSessionApiClient';
import { TapTimeEmployeeEnrollmentApiClient } from '../auth/TapTimeEmployeeEnrollmentApiClient';
import { RnNfcScanAdapter } from '../nfc/RnNfcScanAdapter';
import { ExclusiveNfcCaptureArbiter } from '../nfc/ExclusiveNfcCaptureArbiter';
import { OfflineCaptureCoordinator } from '../offline/OfflineCaptureCoordinator';
import { OfflineCaptureLeaseClient } from '../offline/OfflineCaptureLeaseClient';
import { getExpoOfflineCaptureDatabase } from '../offline/ExpoOfflineCaptureDatabase';
import { OfflineInstallationIdentityStore } from '../offline/OfflineInstallationIdentityStore';
import { OfflineLifecycleClient } from '../offline/OfflineLifecycleClient';
import { OfflineSchedulingLifecycle } from '../offline/OfflineSchedulingLifecycle';
import { OfflineSyncScheduler } from '../offline/OfflineSyncScheduler';
import { createNativeAndroidMonotonicClock } from '../offline/NativeAndroidMonotonicClock';
import {
  offlineBackgroundSchedulerBinding,
} from '../offline/registerOfflineBackgroundTask';
import { ExpoSecureLifecycleEvidenceOutbox } from '../scan/ExpoSecureLifecycleEvidenceOutbox';
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
    new TapTimeEmployeeEnrollmentApiClient(
      configuration.configuration.tapTimeApiBaseUrl,
      expoFetch as typeof fetch,
    ),
    randomUUID,
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
    administration: new TapTimeAdministrationApiClient(
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
  const offlineSessionContext = Object.freeze({
    ...scanSessionContext,
    getState: () => coordinator.getState(),
  });
  const nfcAdapter = new RnNfcScanAdapter({
    platform: Platform.OS,
    captureTimestamp: () => createTimestamp(new Date().toISOString()),
  });
  const nfcArbiter = new ExclusiveNfcCaptureArbiter(nfcAdapter);
  const lifecycleNfc = nfcArbiter.scope('lifecycle');
  const administrationNfc = nfcArbiter.scope('administration');
  const offlineLifecycle = new OfflineLifecycleClient(
    new URL(configuration.configuration.tapTimeApiBaseUrl),
    authenticatedRequests,
  );
  const scanOrchestrator = new OfflineCaptureCoordinator(
    lifecycleNfc,
    lifecycleNfc,
    offlineSessionContext,
    new OfflineInstallationIdentityStore(),
    getExpoOfflineCaptureDatabase,
    new OfflineCaptureLeaseClient(
      new URL(configuration.configuration.tapTimeApiBaseUrl),
      authenticatedRequests,
    ),
    createNativeAndroidMonotonicClock(),
    (database, authorityRejection) => new OfflineSyncScheduler(
      database,
      offlineLifecycle,
      serverTransport.lifecycle,
      authorityRejection,
    ),
    new ExpoSecureLifecycleEvidenceOutbox(),
    randomUUID,
    offlineBackgroundSchedulerBinding,
  );
  const offlineSchedulingLifecycle = new OfflineSchedulingLifecycle(scanOrchestrator);
  const administrationCoordinator = new AdminSetupCoordinator(
    scanSessionContext,
    administrationNfc,
    serverTransport.administration,
    randomUUID,
  );
  return {
    status: 'ready',
    runtime: new DefaultProductMobileRuntime(
      coordinator,
      appStateLifecycle,
      serverTransport,
      scanOrchestrator,
      administrationCoordinator,
      offlineSchedulingLifecycle,
    ),
  };
}
