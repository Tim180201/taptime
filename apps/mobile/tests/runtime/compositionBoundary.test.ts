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

  it('keeps C2 transport private in the composition root and the holding UI truthful', async () => {
    const runtimeSource = await readFile(
      fileURLToPath(new URL('../../src/runtime/ProductMobileRuntime.ts', import.meta.url)),
      'utf8',
    );
    const scanScreenSource = await readFile(
      fileURLToPath(new URL('../../src/screens/ScanScreen.tsx', import.meta.url)),
      'utf8',
    );

    expect(runtimeSource).toContain('AuthenticatedHttpRequestExecutor');
    expect(runtimeSource).toContain('TapTimeScanContextApiClient');
    expect(runtimeSource).toContain('TapTimeLifecycleApiClient');
    expect(runtimeSource).toContain('React receives a real narrow facade');
    expect(runtimeSource).toContain('return this.sessionCapability');
    expect(scanScreenSource).toContain('NFC-Aktivierung folgt in Block D');
    expect(scanScreenSource).not.toMatch(/TextInput|payload|scan-context|lifecycle-events/i);
    expect(scanScreenSource.match(/<Button/g)).toHaveLength(1);
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
});
