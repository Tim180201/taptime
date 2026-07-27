import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DA5_V5_VALIDATION_SOURCE_SCOPES,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';

const mobileDirectory = fileURLToPath(new URL('../..', import.meta.url));

async function source(relativePath: string): Promise<string> {
  return readFile(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    'utf8',
  );
}

describe('DA5 V5 Validation runtime isolation', () => {
  it('uses a dedicated entry with no Product/Auth/DB/Network composition', async () => {
    const entry = await source('../../validation-index.ts');
    const runtime = await source(
      '../../src/validation/createDa5V5ValidationRuntime.ts',
    );
    expect(entry).toContain('Da5V5ValidationMobileApp');
    expect(entry).toContain("AppRegistry.registerComponent('main'");
    expect(entry).toContain('taptime-da5-v5-validation-only-v1');
    expect(`${entry}\n${runtime}`).not.toMatch(
      /registerRootComponent|react-native-url-polyfill|ProductMobile|DefaultProduct|Supabase|Authenticated|OfflineCapture|SQLite|SecureStore|fetch\(|http:|https:|Lifecycle|TimeEntry/u,
    );
  });

  it('keeps the complete Validation JS graph independent of Product barrels and actions', async () => {
    const graph = await Promise.all([
      '../../validation-index.ts',
      '../../modules/taptime-da5-v5-validation-device-binding/index.ts',
      '../../src/validation/Da5V5ValidationContract.ts',
      '../../src/validation/Da5V5ValidationController.ts',
      '../../src/validation/Da5V5ValidationDeviceBinding.ts',
      '../../src/validation/Da5V5ValidationMobileApp.tsx',
      '../../src/validation/Da5V5ValidationNfcCapture.ts',
      '../../src/validation/NativeDa5V5ValidationDeviceBinding.ts',
      '../../src/validation/createDa5V5ValidationRuntime.ts',
    ].map(source));
    expect(graph.join('\n')).not.toMatch(
      /@taptime\/core|@supabase|expo-secure-store|expo-sqlite|expo-network|ProductMobile|OfflineCapture|LifecycleClient|TimeEntry|\/v1\/|fetch\(|https?:\/\//u,
    );
  });

  it('keeps raw NFC material outside observable React/UI state', async () => {
    const ui = await source(
      '../../src/validation/Da5V5ValidationMobileApp.tsx',
    );
    const controller = await source(
      '../../src/validation/Da5V5ValidationController.ts',
    );
    expect(`${ui}\n${controller}`).not.toMatch(
      /canonicalPayload|tag\.id|techTypes|nfc:uid|NfcManager|console\.|logger|AsyncStorage|SecureStore|fetch\(/u,
    );
    expect(ui).toContain('12-HEX SHA-256 FINGERPRINT');
    expect(ui).toContain('GERÄTE-CHECKPOINT');
    expect(ui).toContain('Gerätebindung exakt bestätigen');
    expect(ui).toContain('state.deviceBinding.androidApiLevel');
    expect(ui).toContain('state.deviceBinding.fontScale');
    expect(ui).toContain('state.deviceBinding.talkBackPackageName');
    expect(ui).toContain('state.deviceBinding.talkBackPackageVersion');
    expect(ui).toContain('TALKBACK PROVIDER-PAKET (EXAKT)');
    expect(ui).toContain('TALKBACK PROVIDER-VERSION (EXAKT)');
    expect(ui).toContain("technology ?? 'Noch nicht geprüft'");
    expect(ui).toContain('ROLLE');
  });

  it('binds the distinct package and bypasses Product Tag Dispatch', async () => {
    const config = await source('../../app.config.js');
    expect(config).toContain("appVariant === 'da5-v5-validation'");
    expect(config).toContain(
      "runtimeVariant === 'da5-v5-validation'",
    );
    expect(config).toContain('com.tim180201.mobile.validation');
    expect(config).toContain(
      'withDa5V5ValidationAndroidBoundary(configuration)',
    );
    expect(config).toMatch(
      /if \(da5V5Validation\)[\s\S]*withDa5V5ValidationAndroidBoundary\(configuration\)[\s\S]*else[\s\S]*withNfcTagDispatch\(configuration\)/u,
    );
  });

  it('resolves the opt-in config without scheme, Product plugins or cloud binding', () => {
    const script = `
      const config = require('./app.config.js');
      process.stdout.write(JSON.stringify({
        extra: config.extra,
        name: config.name,
        packageName: config.android.package,
        permissions: config.android.permissions,
        plugins: config.plugins,
        scheme: config.scheme ?? null,
        updates: config.updates,
      }));
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: mobileDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        APP_VARIANT: 'da5-v5-validation',
        EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'da5-v5-validation',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      extra: {},
      name: 'TapTim.e DA5 Validation',
      packageName: 'com.tim180201.mobile.validation',
      permissions: ['android.permission.NFC'],
      plugins: [[
        'react-native-nfc-manager',
        {
          nfcPermission:
            'TapTim.e validates explicitly presented local NFC tags.',
          selectIdentifiers: [],
          systemCodes: [],
        },
      ]],
      scheme: null,
      updates: { enabled: false },
    });
  });

  it('keeps historical two-Tag Block-D sources separate from the DA5 A/B/X proof', async () => {
    const legacyController = await source(
      '../../src/validation/PhysicalValidationController.ts',
    );
    const da5Controller = await source(
      '../../src/validation/Da5V5ValidationController.ts',
    );
    expect(legacyController).toContain("export type ValidationSlot = 'A' | 'B'");
    expect(legacyController).not.toContain("'X'");
    expect(da5Controller).toContain(
      "DA5_V5_VALIDATION_ROLES = ['A', 'B', 'X']",
    );
    expect(da5Controller).not.toContain('PhysicalValidationController');
  });

  it('keeps build publication offline, external and cleanup-bounded', async () => {
    const build = await source(
      '../../scripts/buildDa5V5ValidationAndroid.mjs',
    );
    const publisher = await source(
      '../../scripts/publishDa5V5ValidationArtifact.mjs',
    );
    expect(build).toContain(
      "const mobileDirectory = resolve(\n"
      + "  fileURLToPath(new URL('..', import.meta.url)),\n"
      + ');',
    );
    expect(build).toContain("'--offline', '--no-daemon'");
    expect(build).toContain('createDa5V5ValidationBuildEnvironment');
    expect(build).toContain('createDa5V5ValidationSourceClosure');
    expect(build).toContain('assertValidationModuleGraph');
    expect(build).toMatch(
      /'resolve',\s*'--platform',\s*'android',\s*'--json'/u,
    );
    expect(build).toMatch(
      /'react-native-config',\s*'--platform',\s*'android',\s*'--json'/u,
    );
    expect(build).toContain(
      'assertDa5V5ValidationAutolinkingResolution',
    );
    expect(build).toContain(
      'assertDa5V5ValidationReactNativeAutolinkingResolution',
    );
    expect(build.match(
      /verifyDa5V5ValidationNativeSourceClosure\(repositoryRoot\)/gu,
    )).toHaveLength(2);
    expect(build).toContain("'--ignored=matching'");
    expect(build).toContain("'--untracked-files=all'");
    expect(build).toContain("'apps/mobile/android'");
    expect(build).toContain('publishDa5V5ValidationArtifact');
    expect(build).toContain('processes.commitPublication(publicationReceipt)');
    expect(build).toContain('publicationReceipt?.isRevocable() === true');
    expect(build).toContain(
      "rmSync(androidDirectory, { force: true, recursive: true })",
    );
    expect(build).not.toMatch(/\beas\b|--network|https?:\/\//iu);
    expect(build).not.toContain('spawnSync');
    expect(publisher).toContain("openSync(lockPath, 'wx'");
    expect(publisher).toContain(
      'output directory must be external to the repository',
    );
    expect(publisher).toContain('renameSync(stagingDirectory, finalDirectory)');
    expect(DA5_V5_VALIDATION_SOURCE_SCOPES).toEqual(
      expect.arrayContaining([
        ':(glob)apps/mobile/.env*',
        ':(glob)apps/mobile/babel.config.*',
        ':(glob)apps/mobile/metro.config.*',
        ':(glob)apps/mobile/react-native.config.*',
        'apps/mobile/src/validation',
        'apps/mobile/modules',
        'apps/mobile/scripts/da5V5ValidationNativeSourceBinding.mjs',
        'package-lock.json',
        'package.json',
      ]),
    );
  });
});
