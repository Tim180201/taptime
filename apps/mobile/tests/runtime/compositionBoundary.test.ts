import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectMobileCompositionMode } from '../../src/runtime/compositionMode';

// Only host/native ports are replaced. The factory, runtime and product coordinators are real.
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: {} }));
vi.mock('expo/fetch', () => ({ fetch: vi.fn(() => { throw new Error('Unexpected network request'); }) }));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(), getRandomBytesAsync: vi.fn() }));
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn() }));
vi.mock('expo-network', () => ({}));
vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));
vi.mock('expo-background-task', () => ({}));
vi.mock('expo-task-manager', () => ({ isTaskDefined: () => true }));
vi.mock('react-native-nfc-manager', () => ({ default: {}, NfcEvents: {} }));
vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {} }), processLock: vi.fn() }));

import { OfflineCaptureCoordinator } from '../../src/offline/OfflineCaptureCoordinator';
import { AdminSetupCoordinator } from '../../src/administration/AdminSetupCoordinator';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import { createProductMobileRuntime } from '../../src/runtime/ProductMobileRuntime';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('C1 Mobile composition boundary', () => {
  it.each([
    [false, false, false, 'product'],
    [false, false, true, 'product'],
    [false, true, true, 'demo'],
    [false, true, false, 'configuration_forbidden'],
    [true, false, false, 'physical_validation'],
    [true, false, true, 'physical_validation'],
    [true, true, true, 'configuration_forbidden'],
  ] as const)('selects %s/%s/%s as %s', (validationRequested, demoRequested, developmentBuild, expected) => {
    expect(selectMobileCompositionMode(validationRequested, demoRequested, developmentBuild)).toBe(expected);
  });

  it('keeps product screens free of fake auth, demo pipeline, tokens, and storage infrastructure', async () => {
    const contents = await Promise.all([
      '../../src/screens/LoginScreen.tsx',
      '../../src/screens/ScanScreen.tsx',
      '../../src/navigation/AppNavigator.tsx',
      '../../src/ProductMobileApp.tsx',
    ].map((relativePath) => readFile(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')));
    const productSource = contents.join('\n');

    for (const forbidden of [
      'FakeAuthenticationGateway',
      'SessionService',
      'buildScanDemoPipeline',
      'SupabaseEmailPasswordAuthAdapter',
      'ExpoRefreshTokenStore',
      'AuthenticatedHttpRequestExecutor',
      'TapTimeLifecycleApiClient',
      'ServerCanonicalLifecycleIngestionCoordinator',
      'TenantReadSessionCoordinator',
      'accessToken',
      'refreshToken',
    ]) {
      expect(productSource).not.toContain(forbidden);
    }
  });

  it('wires the real product factory to one offline capture owner behind its public facades', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://auth.example.invalid');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_composition_test');
    vi.stubEnv('EXPO_PUBLIC_TAPTIME_API_BASE_URL', 'https://api.example.invalid');
    const scan = vi.spyOn(OfflineCaptureCoordinator.prototype, 'scan').mockResolvedValue();
    const cancel = vi.spyOn(OfflineCaptureCoordinator.prototype, 'cancel').mockResolvedValue();
    const retry = vi.spyOn(OfflineCaptureCoordinator.prototype, 'retry').mockResolvedValue();
    const readTargets = vi.spyOn(OfflineCaptureCoordinator.prototype, 'readOfflineManualTargets')
      .mockResolvedValue({ status: 'unavailable' });
    const captureBreak = vi.spyOn(OfflineCaptureCoordinator.prototype, 'captureBreak')
      .mockResolvedValue({ status: 'unavailable' });
    const administration = vi.spyOn(AdminSetupCoordinator.prototype, 'refresh').mockResolvedValue();
    const work = vi.spyOn(MobileWorkCoordinator.prototype, 'refresh').mockResolvedValue();

    const result = createProductMobileRuntime();
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Product runtime was not created');
    const { runtime } = result;
    await runtime.scan.scan();
    await runtime.scan.cancel();
    await runtime.scan.retry();
    await runtime.offlineManual.readOfflineManualTargets();
    expect(runtime.offlineManual.captureBreak).toBeTypeOf('function');
    await runtime.offlineManual.captureBreak!();
    await runtime.administration.refresh();
    await runtime.work.refresh();

    expect(scan).toHaveBeenCalledOnce();
    const owner = scan.mock.contexts[0];
    expect(owner).toBeInstanceOf(OfflineCaptureCoordinator);
    for (const action of [cancel, retry, readTargets, captureBreak]) {
      expect(action).toHaveBeenCalledOnce();
      expect(action.mock.contexts[0]).toBe(owner);
    }
    expect(administration).toHaveBeenCalledOnce();
    expect(administration.mock.contexts[0]).toBeInstanceOf(AdminSetupCoordinator);
    expect(work).toHaveBeenCalledOnce();
    expect(work.mock.contexts[0]).toBeInstanceOf(MobileWorkCoordinator);
    expect(runtime.scan).not.toBe(owner);
    expect(Object.isFrozen(runtime.scan)).toBe(true);
    expect(runtime.scan).not.toHaveProperty('session');
    expect(runtime.session).not.toHaveProperty('captureAuthenticatedSessionSnapshot');
  });

  it('keeps administration capture and tokens out of React, persistence, and logging surfaces', async () => {
    const reactSource = (await Promise.all([
      '../../src/screens/AdminSetupScreen.tsx',
      '../../src/navigation/AppNavigator.tsx',
      '../../src/runtime/DefaultProductMobileRuntime.ts',
      '../../src/ProductMobileApp.tsx',
    ].map((relativePath) => readFile(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      'utf8',
    )))).join('\n');
    expect(reactSource).not.toMatch(
      /canonicalPayload|nfc:uid|accessToken|refreshToken|SecureStore|AsyncStorage|console\.|logger/i,
    );

    const coordinatorSource = await readFile(
      fileURLToPath(new URL('../../src/administration/AdminSetupCoordinator.ts', import.meta.url)),
      'utf8',
    );
    expect(coordinatorSource).toContain('canonicalPayload: capture.payload');
    expect(coordinatorSource).not.toMatch(
      /SecureStore|AsyncStorage|FileSystem|persist|enqueue|console\.|logger/i,
    );
  });

  it('keeps lifecycle decisions out of Mobile orchestration and delegates only to the server result', async () => {
    const orchestratorSource = await readFile(
      fileURLToPath(new URL('../../src/offline/OfflineCaptureCoordinator.ts', import.meta.url)),
      'utf8',
    );
    for (const forbidden of [
      'BusinessEngine',
      'startedAt',
      'stoppedAt',
      'activeTimeEntry',
      'findActive',
      'duplicateWindow',
    ]) {
      expect(orchestratorSource).not.toContain(forbidden);
    }
    expect(orchestratorSource).toContain('database.appendEvent(draft)');
    expect(orchestratorSource).toContain("this.scheduler?.trigger('event_append')");
    expect(orchestratorSource).toContain('this.nfcScan.scan()');
    expect(orchestratorSource).not.toContain('waitForNextTag');
    expect(orchestratorSource).toContain('switch (decision.status)');
  });

  it('loads the development demo lazily and never imports it statically', async () => {
    const appSource = await readFile(
      fileURLToPath(new URL('../../App.tsx', import.meta.url)),
      'utf8',
    );
    expect(appSource).toContain("import('./src/demo/DemoMobileApp')");
    expect(appSource).not.toMatch(/^import .*\.\/src\/demo\//m);
    expect(appSource).toContain("process.env.EXPO_PUBLIC_TAPTIME_DEMO_MODE === 'true'");
    expect(appSource).toContain("process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT === 'physical-validation'");
    expect(appSource).toContain("import('./src/validation/PhysicalValidationMobileApp')");
    expect(appSource).toContain('__DEV__');
  });

  it('invalidates an obsolete runtime-start failure observer during React cleanup', async () => {
    const productAppSource = await readFile(
      fileURLToPath(new URL('../../src/ProductMobileApp.tsx', import.meta.url)),
      'utf8',
    );
    expect(productAppSource).toMatch(/active = false;\s+runtime\.stop\(\);/);
  });

  it('keeps the physical validation UI local and free of raw UID disclosure', async () => {
    const uiSource = await readFile(
      fileURLToPath(new URL('../../src/validation/PhysicalValidationMobileApp.tsx', import.meta.url)),
      'utf8',
    );
    const runtimeSource = await readFile(
      fileURLToPath(new URL('../../src/validation/createPhysicalValidationRuntime.ts', import.meta.url)),
      'utf8',
    );
    expect(uiSource).toContain('keine Zeiterfassung');
    expect(uiSource).toContain('keine Serverübertragung');
    expect(uiSource).toContain('PRÜF-FINGERPRINT · SHA-256 GEKÜRZT');
    expect(runtimeSource).toContain('CryptoDigestAlgorithm.SHA256');
    expect(uiSource).not.toMatch(/payload|tag\.id|NfcManager|fetch\(|supabase|expo-crypto/i);
    expect(runtimeSource).not.toMatch(/fetch\(|supabase/i);
  });

  it('shows Web as explicitly unsupported without enabling a native NFC runtime', async () => {
    const productAppSource = await readFile(
      fileURLToPath(new URL('../../src/ProductMobileApp.tsx', import.meta.url)),
      'utf8',
    );
    expect(productAppSource).toContain("Platform.OS === 'web'");
    expect(productAppSource).toContain('ausschließlich auf Android verfügbar');
    expect(productAppSource).not.toContain('NfcManager');
  });
});
