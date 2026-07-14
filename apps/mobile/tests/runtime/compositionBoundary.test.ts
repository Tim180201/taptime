import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { selectMobileCompositionMode } from '../../src/runtime/compositionMode';

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
      'TapTimeScanContextApiClient',
      'TapTimeLifecycleApiClient',
      'ServerCanonicalLifecycleIngestionCoordinator',
      'TenantReadSessionCoordinator',
      'accessToken',
      'refreshToken',
    ]) {
      expect(productSource).not.toContain(forbidden);
    }
  });

  it('keeps C2 transport and native NFC private while React receives only the scan facade', async () => {
    const runtimeSource = (await Promise.all([
      '../../src/runtime/ProductMobileRuntime.ts',
      '../../src/runtime/DefaultProductMobileRuntime.ts',
    ].map((relativePath) => readFile(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      'utf8',
    )))).join('\n');
    const scanScreenSource = await readFile(
      fileURLToPath(new URL('../../src/screens/ScanScreen.tsx', import.meta.url)),
      'utf8',
    );

    expect(runtimeSource).toContain('AuthenticatedHttpRequestExecutor');
    expect(runtimeSource).toContain("fetch as expoFetch } from 'expo/fetch'");
    expect(runtimeSource).toContain('AuthenticatedHttpRequestExecutor(coordinator, expoFetch)');
    expect(runtimeSource).toContain('TapTimeScanContextApiClient');
    expect(runtimeSource).toContain('TapTimeLifecycleApiClient');
    expect(runtimeSource).toContain('React receives a real narrow facade');
    expect(runtimeSource).toContain('return this.sessionCapability');
    expect(runtimeSource).toContain('new RnNfcScanAdapter');
    expect(runtimeSource).toContain('new ProductScanOrchestrator');
    expect(runtimeSource).toContain('new ExpoSecureLifecycleEvidenceOutbox');
    expect(runtimeSource).not.toContain('waitForNextTag');
    expect(runtimeSource).toContain('randomUUID');
    expect(runtimeSource).not.toContain('Math.random');
    expect(runtimeSource).toContain('return this.scanCapability');
    expect(scanScreenSource).toContain('NFC-Tag scannen');
    expect(scanScreenSource).toContain('Scan abbrechen');
    expect(scanScreenSource).toContain('Unveränderte Daten erneut senden');
    expect(scanScreenSource).toContain('Abmelden');
    expect(scanScreenSource).toContain("disabled={state.status !== 'ready'}");
    expect(scanScreenSource).not.toMatch(
      /TextInput|payload|scan-context|lifecycle-events|NfcManager|accessToken|refreshToken/i,
    );
  });

  it('keeps lifecycle decisions out of Mobile orchestration and delegates only to the server result', async () => {
    const orchestratorSource = await readFile(
      fileURLToPath(new URL('../../src/scan/ProductScanOrchestrator.ts', import.meta.url)),
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
    expect(orchestratorSource).toContain('this.lifecycle.ingest(pending.command)');
    expect(orchestratorSource).toContain('this.nfcScan.scan()');
    expect(orchestratorSource).not.toContain('waitForNextTag');
    expect(orchestratorSource).toContain('switch (result.decision.status)');
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

  it('keeps the synthetic E2E build on the real product composition and loopback-only transport',
    async () => {
      const [
        appSource,
        configSource,
        networkPolicySource,
        buildSource,
        installSource,
        disconnectSource,
      ] = await Promise.all([
        readFile(fileURLToPath(new URL('../../App.tsx', import.meta.url)), 'utf8'),
        readFile(fileURLToPath(new URL('../../app.config.js', import.meta.url)), 'utf8'),
        readFile(fileURLToPath(new URL(
          '../../plugins/withSyntheticE2eNetworkSecurity.js',
          import.meta.url,
        )), 'utf8'),
        readFile(fileURLToPath(new URL(
          '../../scripts/buildSyntheticE2eAndroid.mjs',
          import.meta.url,
        )), 'utf8'),
        readFile(fileURLToPath(new URL(
          '../../scripts/installSyntheticE2eAndroid.mjs',
          import.meta.url,
        )), 'utf8'),
        readFile(fileURLToPath(new URL(
          '../../scripts/disconnectSyntheticE2eAndroid.mjs',
          import.meta.url,
        )), 'utf8'),
      ]);
      expect(configSource).toContain("appVariant === 'synthetic-e2e'");
      expect(configSource).toContain("runtimeVariant === 'synthetic-e2e'");
      expect(configSource).toContain('com.tim180201.mobile.synthetic');
      expect(configSource).toContain('withSyntheticE2eNetworkSecurity(configuration)');
      expect(appSource).not.toContain("=== 'synthetic-e2e'");
      expect(networkPolicySource).toContain('base-config cleartextTrafficPermitted="false"');
      expect(networkPolicySource).toContain('<domain includeSubdomains="false">127.0.0.1</domain>');
      expect(buildSource).toContain('EXPO_PUBLIC_TAPTIME_DEMO_MODE: \'false\'');
      expect(buildSource).toContain("APP_VARIANT: 'synthetic-e2e'");
      expect(buildSource).not.toMatch(/https?:\/\/(?!127\.0\.0\.1)/);
      expect(buildSource).toContain('existsSync(androidDirectory)');
      expect(buildSource).not.toContain("'--clean'");
      expect(buildSource).toContain('packageJsonBeforePrebuild');
      expect(buildSource).toContain('writeFileSync(packageJsonPath, packageJsonBeforePrebuild');
      expect(installSource).toContain("['reverse', '--list']");
      expect(installSource).toContain('activeMappings.length !== requiredMappings.length');
      expect(installSource).toContain("['reverse', '--remove', device]");
      expect(installSource).toContain('android:synthetic-e2e:disconnect');
      expect(disconnectSource).toContain("['reverse', '--remove', device]");
      expect(disconnectSource).not.toContain("'--remove-all'");
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
