import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { selectMobileCompositionMode } from '../../src/runtime/compositionMode';

describe('C1 Mobile composition boundary', () => {
  it.each([
    [false, false, 'product'],
    [false, true, 'product'],
    [true, true, 'demo'],
    [true, false, 'demo_forbidden'],
  ] as const)('selects %s/%s as %s', (demoRequested, developmentBuild, expected) => {
    expect(selectMobileCompositionMode(demoRequested, developmentBuild)).toBe(expected);
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
    const runtimeSource = await readFile(
      fileURLToPath(new URL('../../src/runtime/ProductMobileRuntime.ts', import.meta.url)),
      'utf8',
    );
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
    expect(appSource).toContain('__DEV__');
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
