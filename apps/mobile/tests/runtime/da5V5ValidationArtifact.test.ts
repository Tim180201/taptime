import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDa5V5ValidationArtifactManifest,
  DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
  DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
  inspectDa5V5ValidationApk,
  inspectDa5V5ValidationHermesBytecode,
  inspectDa5V5ValidationManifestXmlTree,
  inspectDa5V5ValidationNativeBytecode,
  requireDa5V5ValidationAndroidSdkAuthority,
  resolveDa5V5ValidationHermesCompilerPath,
  resolveDa5V5ValidationPackagedXmlPath,
  serializeDa5V5ValidationArtifactManifest,
  verifyDa5V5ValidationApkInspection,
  verifyDa5V5ValidationArtifactBinding,
  type Da5V5ValidationApkInspection,
  type Da5V5ValidationArtifactDependencies,
  type Da5V5ValidationInspectionTools,
} from '../../scripts/da5V5ValidationArtifact.mjs';
import {
  assertDa5V5ValidationAutolinkingResolution,
  assertDa5V5ValidationPrebuildPackageJson,
  assertDa5V5ValidationReactNativeAutolinkingResolution,
  createDa5V5ValidationAutolinkingPackageJson,
  createDa5V5ValidationBuildEnvironment,
  DA5_V5_VALIDATION_ANDROID_PACKAGE,
  DA5_V5_VALIDATION_DEVICE_MODULE,
  DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES,
  DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST,
  DA5_V5_VALIDATION_REACT_NATIVE_ALLOWLIST,
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
  type Da5V5ValidationToolIdentityDependencies,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';
import {
  DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE,
  DA5_V5_VALIDATION_NATIVE_SOURCE_CONTRACT,
} from '../../scripts/da5V5ValidationNativeSourceBinding.mjs';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const sourceCommit = 'a'.repeat(40);
const sourceTree = 'b'.repeat(40);
const repositoryRoot = '/synthetic/repository';
const mobileDirectory = `${repositoryRoot}/apps/mobile`;
const sourceClosure = DA5_V5_VALIDATION_SOURCE_CLOSURE.map((path) => ({
  path,
  sha256: 'c'.repeat(64),
}));
const apkBytes = Buffer.from('synthetic-validation-apk', 'utf8');
const apkSha256 = createHash('sha256').update(apkBytes).digest('hex');
const manifest = createDa5V5ValidationArtifactManifest({
  apkBytes: apkBytes.length,
  apkSha256,
  sourceCommit,
  sourceClosure,
  sourceTree,
});
const manifestBytes = Buffer.from(
  serializeDa5V5ValidationArtifactManifest(manifest),
  'utf8',
);
const manifestSha256 = createHash('sha256')
  .update(manifestBytes)
  .digest('hex');

afterEach(() => {
  vi.mocked(spawnSync).mockReset();
});

describe('DA5 V5 Validation artifact contract', () => {
  it('requires one explicit canonical and internally identical Android SDK authority', () => {
    expect(requireDa5V5ValidationAndroidSdkAuthority({
      androidHome: '/synthetic/android-sdk',
    })).toEqual({
      androidHome: '/synthetic/android-sdk',
      androidSdkRoot: undefined,
      path: '/synthetic/android-sdk',
    });
    expect(requireDa5V5ValidationAndroidSdkAuthority({
      androidHome: '/synthetic/android-sdk',
      androidSdkRoot: '/synthetic/android-sdk',
    }).path).toBe('/synthetic/android-sdk');
    for (const authority of [
      undefined,
      {},
      { androidHome: 'relative/sdk' },
      { androidHome: '/synthetic/sdk/../other' },
      {
        androidHome: '/synthetic/android-sdk',
        androidSdkRoot: '/different/android-sdk',
      },
    ]) {
      expect(() =>
        requireDa5V5ValidationAndroidSdkAuthority(authority),
      ).toThrow(/Android SDK authority/u);
    }
  });

  it('rejects equal-size in-place tool tamper after APK inspection', () => {
    const fixture = inspectionToolFixture();
    const unzipPath = fixture.tools.unzip.path;
    const before = fixture.dependencies.lstat(unzipPath);
    const beforeSha256 = fixture.dependencies.sha256(unzipPath);
    mockValidInspectionCommands(fixture.tools, () => {
      const bytes = fixture.contents.get(unzipPath);
      if (bytes === undefined) throw new Error('missing unzip fixture');
      const tampered = Buffer.from(bytes);
      tampered[tampered.length - 1] ^= 0x01;
      fixture.contents.set(unzipPath, tampered);
    });

    expect(() => inspectDa5V5ValidationApk(
      '/synthetic/validation.apk',
      {
        androidHome: '/synthetic/android-sdk',
        androidSdkRoot: '/synthetic/android-sdk',
      },
      fixture.tools,
      fixture.dependencies,
    )).toThrow(/tool identity mismatch/u);

    expect(vi.mocked(spawnSync)).toHaveBeenCalledTimes(10);
    const after = fixture.dependencies.lstat(unzipPath);
    expect({
      dev: after.dev,
      ino: after.ino,
      mode: after.mode,
      size: after.size,
    }).toEqual({
      dev: before.dev,
      ino: before.ino,
      mode: before.mode,
      size: before.size,
    });
    expect(fixture.dependencies.sha256(unzipPath))
      .not.toBe(beforeSha256);
  });

  it('binds exact source, local-only signer, runtime and immutable APK metadata', () => {
    expect(manifest).toMatchObject({
      allowBackup: false,
      apkBytes: apkBytes.length,
      apkMode: '0444',
      apkSha256,
      backupPolicy: 'deny-all-cloud-and-device-transfer',
      entryFile: 'validation-index.ts',
      networkPolicy: 'no-network-permission-and-deny-all-cleartext',
      nativeSourceBytes:
        DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE.bytes,
      nativeSourceContract: DA5_V5_VALIDATION_NATIVE_SOURCE_CONTRACT,
      nativeSourceDirectories:
        DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE.directories,
      nativeSourceEntries:
        DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE.entries,
      nativeSourceFiles:
        DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE.files,
      nativeSourceSha256:
        DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE.sha256,
      packageName: 'com.tim180201.mobile.validation',
      permissions:
        'android.permission.NFC-plus-package-private-signature-receiver-guard',
      productDeepLinks: false,
      productTagDispatch: false,
      runtimeMarker: 'taptime-da5-v5-validation-only-v1',
      runtimeVariant: 'da5-v5-validation',
      signerCertificateSha256: DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
      signingScope: 'local-validation-only',
      sourceCommit,
      sourceClosure,
      sourceTree,
      technology: 'NfcA',
    });
  });

  it('accepts only the closed APK inspection boundary', () => {
    expect(verifyDa5V5ValidationApkInspection(validInspection())).toEqual({
      status: 'match',
    });
    for (const field of [
      'packageName',
      'permissions',
      'privateReceiverPermissionGuard',
      'nfcFeatureRequired',
      'allowBackup',
      'backupPolicyDenyAll',
      'cleartextTraffic',
      'networkSecurityConfig',
      'networkPolicyDenyAll',
      'httpsBrowsableQueryIntentExact',
      'packageVisibilityQueriesExact',
      'queryPackages',
      'productDeepLinks',
      'productTagDispatch',
      'requiredNativeModules',
      'forbiddenNativeModules',
      'validationRuntimeMarker',
      'productRuntimeMarker',
      'signerCertificateSha256',
    ] as const) {
      const valid = validInspection();
      const value = valid[field];
      const invalid = Array.isArray(value)
        ? [...value, 'android.permission.INTERNET']
        : typeof value === 'boolean'
          ? !value
          : `different-${value}`;
      expect(() => verifyDa5V5ValidationApkInspection({
        ...valid,
        [field]: invalid,
      })).toThrow('DA5 V5 Validation APK boundary mismatch');
    }
  });

  it.each([
    {
      name: 'missing Samsung query',
      queryPackages: ['com.google.android.marvin.talkback'],
    },
    {
      name: 'additional foreign query',
      queryPackages: [
        ...DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
        'com.example.accessibility',
      ],
    },
  ])('rejects $name in the built APK inspection', ({
    queryPackages,
  }) => {
    expect(() => verifyDa5V5ValidationApkInspection({
      ...validInspection(),
      queryPackages,
    })).toThrow('DA5 V5 Validation APK boundary mismatch');
  });

  it('binds exact TalkBack packages and the HTTPS Browsable APK query', () => {
    const missing = inspectDa5V5ValidationManifestXmlTree(
      queryManifestXmlTree({
        packages: ['com.google.android.marvin.talkback'],
      }),
    );
    const exact = inspectDa5V5ValidationManifestXmlTree(
      queryManifestXmlTree(),
    );
    const expanded = inspectDa5V5ValidationManifestXmlTree(
      queryManifestXmlTree({
        packages: [
          ...DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
          'com.example.accessibility',
        ],
      }),
    );

    expect(missing).toMatchObject({
      httpsBrowsableQueryIntentExact: true,
      packageVisibilityQueriesExact: false,
      queryPackages: ['com.google.android.marvin.talkback'],
    });
    expect(exact).toMatchObject({
      httpsBrowsableQueryIntentExact: true,
      packageVisibilityQueriesExact: true,
      queryPackages: DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
    });
    expect(expanded).toMatchObject({
      httpsBrowsableQueryIntentExact: true,
      packageVisibilityQueriesExact: false,
      queryPackages: [
        ...DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
        'com.example.accessibility',
      ],
    });
  });

  it.each([
    {
      name: 'missing intent',
      options: { intents: [] },
    },
    {
      name: 'additional intent',
      options: { intents: [{}, {}] },
    },
    {
      name: 'drifted action',
      options: { intents: [{ actions: ['android.intent.action.SEND'] }] },
    },
    {
      name: 'additional action',
      options: {
        intents: [{
          actions: [
            'android.intent.action.VIEW',
            'android.intent.action.SEND',
          ],
        }],
      },
    },
    {
      name: 'drifted category',
      options: {
        intents: [{
          categories: ['android.intent.category.DEFAULT'],
        }],
      },
    },
    {
      name: 'additional category',
      options: {
        intents: [{
          categories: [
            'android.intent.category.BROWSABLE',
            'android.intent.category.DEFAULT',
          ],
        }],
      },
    },
    {
      name: 'drifted scheme',
      options: { intents: [{ schemes: ['http'] }] },
    },
    {
      name: 'additional scheme',
      options: { intents: [{ schemes: ['https', 'http'] }] },
    },
  ])('rejects $name in the APK query intent', ({ options }) => {
    expect(inspectDa5V5ValidationManifestXmlTree(
      queryManifestXmlTree(options),
    )).toMatchObject({
      httpsBrowsableQueryIntentExact: false,
      packageVisibilityQueriesExact: false,
    });
  });

  it('rejects an additional APK query provider', () => {
    expect(inspectDa5V5ValidationManifestXmlTree(
      queryManifestXmlTree({
        providers: ['com.example.documents'],
      }),
    )).toMatchObject({
      httpsBrowsableQueryIntentExact: true,
      packageVisibilityQueriesExact: false,
    });
  });

  it('resolves the two optimized packaged XML resource paths', () => {
    const resources = [
      'resource 0x7f110001 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_data_extraction_rules: t=0x03',
      '  (string8) "res/Oy.xml"',
      'resource 0x7f110002 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_network_security: t=0x03',
      '  (string8) "res/Mi.xml"',
    ].join('\n');

    expect(resolveDa5V5ValidationPackagedXmlPath(
      resources,
      'taptime_da5_v5_validation_data_extraction_rules',
    )).toBe('res/Oy.xml');
    expect(resolveDa5V5ValidationPackagedXmlPath(
      resources,
      'taptime_da5_v5_validation_network_security',
    )).toBe('res/Mi.xml');
  });

  it('ignores query and receiver intent filters outside activities', () => {
    const inspection = inspectDa5V5ValidationManifestXmlTree([
      '  E: manifest (line=2)',
      '    E: permission (line=3)',
      '      A: android:name(0x01010003)="com.tim180201.mobile.validation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"',
      '      A: android:protectionLevel(0x01010009)=(type 0x10)0x2',
      '    E: uses-permission (line=4)',
      '      A: android:name(0x01010003)="android.permission.NFC"',
      '    E: uses-permission (line=5)',
      '      A: android:name(0x01010003)="com.tim180201.mobile.validation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"',
      '    E: queries (line=6)',
      '      E: intent (line=7)',
      '        E: action (line=8)',
      '          A: android:name(0x01010003)="android.intent.action.VIEW"',
      '        E: category (line=9)',
      '          A: android:name(0x01010003)="android.intent.category.BROWSABLE"',
      '    E: application (line=10)',
      '      E: receiver (line=11)',
      '        E: intent-filter (line=12)',
      '          E: action (line=13)',
      '            A: android:name(0x01010003)="android.nfc.action.TECH_DISCOVERED"',
      '      E: activity (line=14)',
      '        E: intent-filter (line=15)',
      '          E: action (line=16)',
      '            A: android:name(0x01010003)="android.intent.action.MAIN"',
    ].join('\n'));

    expect(inspection).toEqual({
      httpsBrowsableQueryIntentExact: false,
      packageVisibilityQueriesExact: false,
      privateReceiverPermissionGuard: true,
      productDeepLinks: false,
      productTagDispatch: false,
      queryPackages: [],
    });
  });

  it('detects deep links and Tag dispatch only in activity filters', () => {
    const inspection = inspectDa5V5ValidationManifestXmlTree([
      '  E: manifest (line=2)',
      '    E: application (line=3)',
      '      E: activity (line=4)',
      '        E: intent-filter (line=5)',
      '          E: action (line=6)',
      '            A: android:name(0x01010003)="android.intent.action.VIEW"',
      '          E: category (line=7)',
      '            A: android:name(0x01010003)="android.intent.category.BROWSABLE"',
      '        E: intent-filter (line=8)',
      '          E: action (line=9)',
      '            A: android:name(0x01010003)="android.nfc.action.TECH_DISCOVERED"',
    ].join('\n'));

    expect(inspection.productDeepLinks).toBe(true);
    expect(inspection.productTagDispatch).toBe(true);
  });

  it.each([
    {
      name: 'foreign',
      permission:
        'com.foreign.validation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
      protectionLevel: '0x2',
    },
    {
      name: 'unprotected',
      permission:
        'com.tim180201.mobile.validation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
      protectionLevel: '0x0',
    },
  ])('rejects a $name private receiver guard', ({
    permission,
    protectionLevel,
  }) => {
    const inspection = inspectDa5V5ValidationManifestXmlTree([
      '  E: manifest (line=2)',
      '    E: permission (line=3)',
      `      A: android:name(0x01010003)="${permission}"`,
      `      A: android:protectionLevel(0x01010009)=(type 0x10)${protectionLevel}`,
      '    E: uses-permission (line=4)',
      '      A: android:name(0x01010003)="android.permission.NFC"',
      '    E: uses-permission (line=5)',
      `      A: android:name(0x01010003)="${permission}"`,
    ].join('\n'));

    expect(inspection.privateReceiverPermissionGuard).toBe(false);
  });

  it.each([
    {
      name: 'missing',
      resourceName: 'taptime_da5_v5_validation_network_security',
      resources: '',
    },
    {
      name: 'multiple',
      resourceName: 'taptime_da5_v5_validation_network_security',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_network_security:',
        '  (string8) "res/Mi.xml"',
        'resource 0x7f110002 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_network_security:',
        '  (string8) "res/Mj.xml"',
      ].join('\n'),
    },
    {
      name: 'unsafe',
      resourceName: 'taptime_da5_v5_validation_network_security',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_network_security:',
        '  (string8) "res/../Mi.xml"',
      ].join('\n'),
    },
    {
      name: 'unexpected resource name',
      resourceName: 'unbound_validation_resource',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.validation:xml/unbound_validation_resource:',
        '  (string8) "res/Mi.xml"',
      ].join('\n'),
    },
  ])('rejects a $name packaged XML binding', ({
    resourceName,
    resources,
  }) => {
    expect(() => resolveDa5V5ValidationPackagedXmlPath(
      resources,
      resourceName,
    )).toThrow(/packaged XML resource binding mismatch/u);
  });

  it('verifies both immutable files, exact source and inspected APK', () => {
    const dependencies = validDependencies();
    expect(verifyDa5V5ValidationArtifactBinding({
      apk: {
        bytes: apkBytes.length,
        mode: 0o444,
        path: '/synthetic/validation.apk',
        sha256: apkSha256,
      },
      expectedSourceCommit: sourceCommit,
      expectedSourceClosure: sourceClosure,
      expectedSourceTree: sourceTree,
      manifest: {
        bytes: manifestBytes.length,
        mode: 0o444,
        path: '/synthetic/validation-manifest.json',
        sha256: manifestSha256,
      },
    }, dependencies)).toEqual({
      packageName: 'com.tim180201.mobile.validation',
      sourceCommit,
      sourceClosure,
      sourceTree,
      status: 'match',
    });
    expect(dependencies.inspectApk).toHaveBeenCalledTimes(1);
    expect(dependencies.files.lstat).toHaveBeenCalledTimes(4);
  });

  it('rejects source drift before accepting an otherwise valid artifact', () => {
    const dependencies = validDependencies();
    expect(() => verifyDa5V5ValidationArtifactBinding({
      apk: {
        bytes: apkBytes.length,
        mode: 0o444,
        path: '/synthetic/validation.apk',
        sha256: apkSha256,
      },
      expectedSourceCommit: 'c'.repeat(40),
      expectedSourceClosure: sourceClosure,
      expectedSourceTree: sourceTree,
      manifest: {
        bytes: manifestBytes.length,
        mode: 0o444,
        path: '/synthetic/validation-manifest.json',
        sha256: manifestSha256,
      },
    }, dependencies)).toThrow(/source\/artifact binding mismatch/u);
    expect(dependencies.inspectApk).not.toHaveBeenCalled();
  });

  it('strips inherited Product/public runtime variables from the offline build', () => {
    const environment = createDa5V5ValidationBuildEnvironment({
      ANDROID_HOME: '/synthetic/sdk',
      APP_VARIANT: 'synthetic-e2e',
      EXPO_PUBLIC_TAPTIME_API_URL: 'http://127.0.0.1:3000',
      EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'synthetic-e2e',
      TAPTIME_PRIVATE_VALUE: 'must-not-survive',
      EAS_ACCESS_TOKEN: 'must-not-survive',
      AWS_SECRET_ACCESS_KEY: 'must-not-survive',
      npm_config_token: 'must-not-survive',
      PASSWORD: 'must-not-survive',
    });
    expect(environment).toMatchObject({
      ANDROID_HOME: '/synthetic/sdk',
      APP_VARIANT: 'da5-v5-validation',
      ENTRY_FILE: 'validation-index.ts',
      EXPO_OFFLINE: '1',
      EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
      EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'da5-v5-validation',
      npm_config_offline: 'true',
    });
    expect(environment).not.toHaveProperty('EXPO_PUBLIC_TAPTIME_API_URL');
    expect(environment).not.toHaveProperty('TAPTIME_PRIVATE_VALUE');
    expect(environment).not.toHaveProperty('EAS_ACCESS_TOKEN');
    expect(environment).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
    expect(environment).not.toHaveProperty('npm_config_token');
    expect(environment).not.toHaveProperty('PASSWORD');
    expect(Object.keys(environment).sort()).toEqual([
      'ANDROID_HOME',
      'APP_VARIANT',
      'ENTRY_FILE',
      'EXPO_NO_TELEMETRY',
      'EXPO_OFFLINE',
      'EXPO_PUBLIC_TAPTIME_DEMO_MODE',
      'EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT',
      'npm_config_audit',
      'npm_config_fund',
      'npm_config_offline',
      'npm_config_update_notifier',
    ]);
  });

  it('switches only the validation build to the isolated native module graph', () => {
    const baseline = JSON.stringify({
      expo: {
        autolinking: {
          exclude: [DA5_V5_VALIDATION_DEVICE_MODULE],
        },
      },
      name: '@taptime/mobile',
    });
    const validation = JSON.parse(
      createDa5V5ValidationAutolinkingPackageJson(baseline),
    );
    expect(validation.expo.autolinking.exclude).toEqual(
      DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES,
    );
    expect(() => assertDa5V5ValidationAutolinkingResolution(
      validExpoResolution(),
      repositoryRoot,
    )).not.toThrow();
    expect(() => assertDa5V5ValidationReactNativeAutolinkingResolution(
      validReactNativeResolution(),
      repositoryRoot,
      mobileDirectory,
    )).not.toThrow();
  });

  it('excludes ExpoAsset from every native packaging boundary', () => {
    expect(DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES).toContain(
      'expo-asset',
    );
    expect(
      DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST.map(
        ({ packageName }) => packageName,
      ),
    ).not.toContain('expo-asset');
  });

  it('accepts exactly the two deterministic Expo prebuild script normalizations', () => {
    const before = `${JSON.stringify({
      name: '@taptime/mobile',
      scripts: {
        android: 'expo start --android',
        ios: 'expo start --ios',
        test: 'vitest run',
      },
    }, null, 2)}\n`;
    const after = `${JSON.stringify({
      name: '@taptime/mobile',
      scripts: {
        android: 'expo run:android',
        ios: 'expo run:ios',
        test: 'vitest run',
      },
    }, null, 2)}\n`;

    expect(() => assertDa5V5ValidationPrebuildPackageJson(
      before,
      after,
    )).not.toThrow();
  });

  it('rejects every foreign package mutation during Expo prebuild', () => {
    const before = `${JSON.stringify({
      name: '@taptime/mobile',
      scripts: {
        android: 'expo start --android',
        ios: 'expo start --ios',
        test: 'vitest run',
      },
    }, null, 2)}\n`;
    const after = `${JSON.stringify({
      name: '@taptime/mobile',
      scripts: {
        android: 'expo run:android',
        ios: 'expo run:ios',
        test: 'vitest run --changed',
      },
    }, null, 2)}\n`;

    expect(() => assertDa5V5ValidationPrebuildPackageJson(
      before,
      after,
    )).toThrow(/attempted to mutate package\.json/u);
  });

  it.each([
    ...DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES,
    'unknown-external-module',
    'unknown-local-module',
  ])('rejects prohibited or unknown Expo native module %s', (packageName) => {
    const graph = validExpoResolution();
    const local = packageName.startsWith('taptime-')
      || packageName === 'unknown-local-module';
    graph.modules.push({
      packageName,
      packageVersion: '1.0.0',
      projects: [{
        name: packageName,
        sourceDir: local
          ? `${mobileDirectory}/modules/${packageName}/android`
          : `${repositoryRoot}/node_modules/${packageName}/android`,
      }],
    });
    expect(() => assertDa5V5ValidationAutolinkingResolution(
      graph,
      repositoryRoot,
    )).toThrow(/module graph/u);
  });

  it('rejects an allowlisted Expo package path shadow', () => {
    const graph = validExpoResolution();
    graph.modules[0]!.projects[0]!.sourceDir =
      `${repositoryRoot}/shadow/expo/android`;
    expect(() => assertDa5V5ValidationAutolinkingResolution(
      graph,
      repositoryRoot,
    )).toThrow(/module graph/u);
  });

  it('requires the exact local-module empty version identity', () => {
    const graph = validExpoResolution();
    const localModule = graph.modules.find(
      ({ packageName }) => packageName === DA5_V5_VALIDATION_DEVICE_MODULE,
    )!;
    delete localModule.packageVersion;
    expect(() => assertDa5V5ValidationAutolinkingResolution(
      graph,
      repositoryRoot,
    )).toThrow(/module graph/u);
  });

  it('rejects unknown and path-shadowed React Native modules', () => {
    const unknown = validReactNativeResolution();
    unknown.dependencies['unknown-native-module'] = {
      platforms: {
        android: {
          packageImportPath: 'import unknown.NativePackage;',
          packageInstance: 'new NativePackage()',
          sourceDir:
            `${repositoryRoot}/node_modules/unknown-native-module/android`,
        },
      },
      root: `${repositoryRoot}/node_modules/unknown-native-module`,
    };
    expect(() => assertDa5V5ValidationReactNativeAutolinkingResolution(
      unknown,
      repositoryRoot,
      mobileDirectory,
    )).toThrow(/module graph/u);

    const shadowed = validReactNativeResolution();
    shadowed.dependencies['react-native-nfc-manager'].platforms.android
      .sourceDir = `${repositoryRoot}/shadow/nfc/android`;
    expect(() => assertDa5V5ValidationReactNativeAutolinkingResolution(
      shadowed,
      repositoryRoot,
      mobileDirectory,
    )).toThrow(/module graph/u);
  });

  it.each([
    ['packageImportPath', 'import shadow.NativePackage;'],
    ['packageInstance', 'new ShadowNativePackage()'],
  ] as const)(
    'rejects React Native %s identity drift',
    (field, value) => {
      const graph = validReactNativeResolution();
      graph.dependencies['react-native-nfc-manager'].platforms.android[
        field
      ] = value;
      expect(() => assertDa5V5ValidationReactNativeAutolinkingResolution(
        graph,
        repositoryRoot,
        mobileDirectory,
      )).toThrow(/module graph/u);
    },
  );

  it('uses decoded Hermes bytecode for validation-only runtime evidence', () => {
    expect(inspectDa5V5ValidationHermesBytecode(
      'String taptime-da5-v5-validation-only-v1',
    )).toEqual({
      productRuntimeMarker: false,
      validationRuntimeMarker: true,
    });
    expect(inspectDa5V5ValidationHermesBytecode(
      'String taptime-da5-v5-validation-only-v1\n'
      + 'String /v1/lifecycle-events',
    )).toEqual({
      productRuntimeMarker: true,
      validationRuntimeMarker: true,
    });
    for (const productMarker of [
      '@supabase/supabase-js',
      'expo-secure-store',
      'expo-sqlite',
      '/v1/offline-capture-leases',
      'OfflineCaptureDatabase',
      'ProductMobile',
    ]) {
      expect(inspectDa5V5ValidationHermesBytecode(
        `String taptime-da5-v5-validation-only-v1\n${productMarker}`,
      ).productRuntimeMarker).toBe(true);
    }
  });

  it('requires exact native capability markers beyond Hermes and permissions', () => {
    const required = [
      'com/taptime/da5validationbinding/Da5V5ValidationDeviceBindingModule',
      'community/revteltech/nfc/NfcManagerPackage',
      'expo/modules/ExpoModulesPackage',
      'expo/modules/crypto/CryptoModule',
    ].join('\n');
    expect(inspectDa5V5ValidationNativeBytecode(
      Buffer.from(required),
    )).toEqual({
      forbiddenNativeModules: false,
      requiredNativeModules: true,
    });
    expect(inspectDa5V5ValidationNativeBytecode(
      Buffer.from(required.replace('expo/modules/crypto/CryptoModule', '')),
    ).requiredNativeModules).toBe(false);
  });

  it.each([
    'expo/modules/network/NetworkModule',
    'expo/modules/securestore/SecureStoreModule',
    'expo/modules/sqlite/SQLiteModule',
    'expo/modules/filesystem/FileSystemModule',
    'expo/modules/backgroundtask/BackgroundTaskModule',
    'expo/modules/taskManager/TaskManagerModule',
    'expo/modules/devlauncher/DevLauncherPackage',
    'expo/modules/devmenu/DevMenuPackage',
    'com/taptime/nfcingress/TapTimeNfcIngressModule',
  ])('detects compiled forbidden native marker %s', (marker) => {
    expect(inspectDa5V5ValidationNativeBytecode(
      Buffer.from(marker),
    ).forbiddenNativeModules).toBe(true);
  });
});

function validExpoResolution(): {
  extraDependencies: never[];
  coreFeatures: never[];
  modules: Array<{
    packageName: string;
    packageVersion?: string;
    projects: Array<{ name: string; sourceDir: string }>;
  }>;
} {
  return {
    coreFeatures: [],
    extraDependencies: [],
    modules: DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST.map((expected) => ({
      packageName: expected.packageName!,
      ...(expected.packageVersion === null
        ? {}
        : { packageVersion: expected.packageVersion! }),
      projects: [{
        name: expected.packageName!,
        sourceDir: `${repositoryRoot}/${expected.repositoryPath}`,
      }],
    })),
  };
}

function validReactNativeResolution(): {
  root: string;
  reactNativePath: string;
  project: {
    android: { packageName: string; sourceDir: string };
  };
  dependencies: Record<string, {
    root: string;
    platforms: {
      android: {
        packageImportPath: string;
        packageInstance: string;
        sourceDir: string;
      };
    };
  }>;
} {
  return {
    dependencies: Object.fromEntries(
      DA5_V5_VALIDATION_REACT_NATIVE_ALLOWLIST.map((expected) => [
        expected.packageName,
        {
          platforms: {
            android: {
              packageImportPath: expected.packageImportPath,
              packageInstance: expected.packageInstance,
              sourceDir: `${repositoryRoot}/${expected.sourcePath}`,
            },
          },
          root: `${repositoryRoot}/${expected.repositoryPath}`,
        },
      ]),
    ),
    project: {
      android: {
        packageName: DA5_V5_VALIDATION_ANDROID_PACKAGE,
        sourceDir: `${mobileDirectory}/android`,
      },
    },
    reactNativePath: `${repositoryRoot}/node_modules/react-native`,
    root: mobileDirectory,
  };
}

function inspectionToolFixture(): Readonly<{
  contents: Map<string, Buffer>;
  dependencies: Da5V5ValidationToolIdentityDependencies;
  tools: Da5V5ValidationInspectionTools;
}> {
  const paths = Object.freeze({
    aapt: '/synthetic/android-sdk/build-tools/35.0.0/aapt',
    apksigner:
      '/synthetic/android-sdk/build-tools/35.0.0/apksigner',
    hermesc: resolveDa5V5ValidationHermesCompilerPath(),
    unzip: '/usr/bin/unzip',
  });
  const contents = new Map<string, Buffer>();
  Object.values(paths).forEach((path, index) => {
    contents.set(path, Buffer.from(`inspection-tool-${index}-A`));
  });
  const identity = (
    path: string,
    index: number,
  ) => Object.freeze({
    bytes: contents.get(path)!.length,
    dev: String(index + 1),
    ino: String(index + 101),
    mode: 0o755,
    path,
    sha256: createHash('sha256').update(contents.get(path)!).digest('hex'),
  });
  const tools = Object.freeze({
    aapt: identity(paths.aapt, 0),
    apksigner: identity(paths.apksigner, 1),
    hermesc: identity(paths.hermesc, 2),
    unzip: identity(paths.unzip, 3),
  });
  const toolPaths = Object.values(paths);
  const dependencies: Da5V5ValidationToolIdentityDependencies = {
    lstat(path: string) {
      const bytes = contents.get(path);
      const index = toolPaths.indexOf(path);
      if (bytes === undefined || index < 0) {
        throw new Error('unexpected inspection tool');
      }
      return {
        dev: BigInt(index + 1),
        ino: BigInt(index + 101),
        mode: 0o100755n,
        size: BigInt(bytes.length),
        isFile: () => true,
        isSymbolicLink: () => false,
      };
    },
    realpath: (path: string) => path,
    sha256(path: string) {
      const bytes = contents.get(path);
      if (bytes === undefined) {
        throw new Error('unexpected inspection tool');
      }
      return createHash('sha256').update(bytes).digest('hex');
    },
  };
  return Object.freeze({ contents, dependencies, tools });
}

function mockValidInspectionCommands(
  tools: Da5V5ValidationInspectionTools,
  tamperUnzip: () => void,
) {
  const privatePermission =
    'com.tim180201.mobile.validation'
    + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION';
  const badging = [
    "package: name='com.tim180201.mobile.validation'"
      + " versionCode='1' versionName='1.0.0'",
    "uses-feature: name='android.hardware.nfc'",
    "uses-permission: name='android.permission.NFC'",
    `uses-permission: name='${privatePermission}'`,
  ].join('\n');
  const androidManifest = [
    'E: manifest',
    '  E: permission',
    `    A: android:name(0x01010003)="${privatePermission}"`,
    '    A: android:protectionLevel(0x01010009)=(type 0x10)0x2',
    '  E: uses-permission',
    '    A: android:name(0x01010003)="android.permission.NFC"',
    '  E: uses-permission',
    `    A: android:name(0x01010003)="${privatePermission}"`,
    '  E: queries',
    ...DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES.flatMap(
      (packageName) => [
        '    E: package',
        `      A: android:name(0x01010003)="${packageName}"`,
      ],
    ),
    '    E: intent',
    '      E: action',
    '        A: android:name(0x01010003)="android.intent.action.VIEW"',
    '      E: category',
    '        A: android:name(0x01010003)="android.intent.category.BROWSABLE"',
    '      E: data',
    '        A: android:scheme(0x01010027)="https"',
    '  E: application',
    '    A: android:allowBackup(0x01010280)=(type 0x12)0x0',
    '    A: android:usesCleartextTraffic(0x010106ec)=(type 0x12)0x0',
    '    A: android:networkSecurityConfig(0x01010527)="@xml/taptime_da5_v5_validation_network_security"',
  ].join('\n');
  const resources = [
    'resource 0x7f110001 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_data_extraction_rules: t=0x03',
    '  (string8) "res/Oy.xml"',
    'resource 0x7f110002 com.tim180201.mobile.validation:xml/taptime_da5_v5_validation_network_security: t=0x03',
    '  (string8) "res/Mi.xml"',
  ].join('\n');
  const networkPolicy = [
    'E: network-security-config',
    '  E: base-config',
    '    A: cleartextTrafficPermitted(0x01010000)=(type 0x12)0x0',
  ].join('\n');
  const backupPolicy = [
    'cloud-backup',
    'device-transfer',
    'database',
    'device_database',
    'device_file',
    'device_root',
    'device_sharedpref',
    'external',
    'file',
    'root',
    'sharedpref',
  ].join('\n');
  const signature = [
    'Verified using v1 scheme (JAR signing): false',
    'Verified using v2 scheme (APK Signature Scheme v2): true',
    'Verified using v3 scheme (APK Signature Scheme v3): false',
    'Verified using v3.1 scheme (APK Signature Scheme v3.1): false',
    'Verified using v4 scheme (APK Signature Scheme v4): false',
    'Number of signers: 1',
    `Signer #1 certificate SHA-256 digest: ${DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256}`,
  ].join('\n');
  const nativeBytecode = Buffer.from([
    'com/taptime/da5validationbinding/Da5V5ValidationDeviceBindingModule',
    'community/revteltech/nfc/NfcManagerPackage',
    'expo/modules/ExpoModulesPackage',
    'expo/modules/crypto/CryptoModule',
  ].join('\0'));

  vi.mocked(spawnSync).mockImplementation((
    command,
    argumentsOrOptions,
  ) => {
    const commandPath = String(command);
    const arguments_ = Array.isArray(argumentsOrOptions)
      ? argumentsOrOptions.map(String)
      : [];
    let stdout: Buffer | string;
    if (commandPath === tools.aapt.path) {
      if (arguments_[1] === 'badging') {
        stdout = badging;
      } else if (arguments_[1] === '--values') {
        stdout = resources;
      } else if (arguments_.at(-1) === 'AndroidManifest.xml') {
        stdout = androidManifest;
      } else if (arguments_.at(-1) === 'res/Mi.xml') {
        stdout = networkPolicy;
      } else if (arguments_.at(-1) === 'res/Oy.xml') {
        stdout = backupPolicy;
      } else {
        throw new Error('unexpected aapt invocation');
      }
    } else if (commandPath === tools.apksigner.path) {
      stdout = signature;
    } else if (commandPath === tools.unzip.path) {
      if (arguments_[0] === '-Z1') {
        stdout = 'assets/index.android.bundle\nclasses.dex\n';
      } else if (arguments_.at(-1) === 'assets/index.android.bundle') {
        stdout = Buffer.from('synthetic-hermes-bundle');
      } else if (arguments_.at(-1) === 'classes.dex') {
        tamperUnzip();
        stdout = nativeBytecode;
      } else {
        throw new Error('unexpected unzip invocation');
      }
    } else if (commandPath === tools.hermesc.path) {
      stdout = 'taptime-da5-v5-validation-only-v1';
    } else {
      throw new Error('unexpected inspection command');
    }
    return {
      error: undefined,
      status: 0,
      stderr: Buffer.isBuffer(stdout) ? Buffer.alloc(0) : '',
      stdout,
    } as never;
  });
}

function validInspection(): Da5V5ValidationApkInspection {
  return {
    allowBackup: false,
    backupPolicyDenyAll: true,
    cleartextTraffic: false,
    hermesBundleCount: 1,
    networkPolicyDenyAll: true,
    networkSecurityConfig: true,
    nfcFeatureRequired: true,
    httpsBrowsableQueryIntentExact: true,
    packageName: 'com.tim180201.mobile.validation',
    packageVisibilityQueriesExact: true,
    permissions: [
      'android.permission.NFC',
      'com.tim180201.mobile.validation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
    ],
    privateReceiverPermissionGuard: true,
    productDeepLinks: false,
    productRuntimeMarker: false,
    productTagDispatch: false,
    queryPackages: [...DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES],
    requiredNativeModules: true,
    forbiddenNativeModules: false,
    signatureV1: false,
    signatureV2: true,
    signatureV3: false,
    signatureV31: false,
    signatureV4: false,
    signerCertificateSha256: DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
    signerCount: 1,
    validationRuntimeMarker: true,
    versionCode: '1',
    versionName: '1.0.0',
  };
}

function queryManifestXmlTree({
  intents = [{}],
  packages = DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
  providers = [],
}: {
  readonly intents?: readonly {
    readonly actions?: readonly string[];
    readonly categories?: readonly string[];
    readonly schemes?: readonly string[];
  }[];
  readonly packages?: readonly string[];
  readonly providers?: readonly string[];
} = {}): string {
  const lines = [
    'E: manifest',
    '  E: queries',
  ];
  for (const packageName of packages) {
    lines.push(
      '    E: package',
      `      A: android:name(0x01010003)="${packageName}"`,
    );
  }
  for (const intent of intents) {
    lines.push('    E: intent');
    for (const action of intent.actions ?? ['android.intent.action.VIEW']) {
      lines.push(
        '      E: action',
        `        A: android:name(0x01010003)="${action}"`,
      );
    }
    for (
      const category of intent.categories
        ?? ['android.intent.category.BROWSABLE']
    ) {
      lines.push(
        '      E: category',
        `        A: android:name(0x01010003)="${category}"`,
      );
    }
    for (const scheme of intent.schemes ?? ['https']) {
      lines.push(
        '      E: data',
        `        A: android:scheme(0x01010027)="${scheme}"`,
      );
    }
  }
  for (const authority of providers) {
    lines.push(
      '    E: provider',
      `      A: android:authorities(0x01010018)="${authority}"`,
    );
  }
  lines.push('  E: application');
  return lines.join('\n');
}

function validDependencies(): Da5V5ValidationArtifactDependencies {
  const contents = new Map([
    ['/synthetic/validation.apk', apkBytes],
    ['/synthetic/validation-manifest.json', manifestBytes],
  ]);
  return {
    files: {
      lstat: vi.fn((path: string) => {
        const bytes = contents.get(path);
        if (bytes === undefined) throw new Error('unexpected path');
        return {
          dev: 1,
          ino: path.endsWith('.apk') ? 1 : 2,
          isFile: () => true,
          isSymbolicLink: () => false,
          mode: 0o444,
          size: bytes.length,
        };
      }),
      readUtf8: vi.fn((path: string) => (
        contents.get(path)?.toString('utf8') ?? ''
      )),
      realpath: vi.fn((path: string) => path),
      sha256: vi.fn((path: string) => createHash('sha256')
        .update(contents.get(path)!)
        .digest('hex')),
    },
    inspectApk: vi.fn(() => validInspection()),
  };
}
