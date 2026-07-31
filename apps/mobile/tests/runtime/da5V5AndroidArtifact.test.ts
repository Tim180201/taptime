import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createDa5V5AndroidInspectionToolAuthority,
  createDa5V5AndroidArtifactVerificationForTest,
  DA5_V5_ANDROID_ARTIFACT,
  DA5_V5_ANDROID_PACKAGE,
  inspectDa5V5ProductManifestXmlTree,
  inspectDa5V5NfcTechFilterXmlTree,
  requireDa5V5AndroidProfile,
  reverifyDa5V5AndroidArtifactForInstall,
  resolveDa5V5NfcTechFilterResourceBinding,
  resolveDa5V5NfcTechFilterResourcePath,
  verifyDa5V5AndroidArtifact,
  verifyDa5V5AndroidArtifactManifest,
  verifyDa5V5ImmutableFile,
  type Da5V5ApkInspection,
  type Da5V5ArtifactDependencies,
  type Da5V5AndroidInspectionToolAuthority,
  type Da5V5FileDependencies,
} from '../../scripts/da5V5AndroidArtifact.mjs';

const syntheticApkBytes = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x81, 0x7f,
  0x44, 0x41, 0x35, 0x2d, 0x56, 0x35, 0x2d, 0x41,
  0x50, 0x4b, 0x2d, 0x53, 0x4e, 0x41, 0x50, 0x53,
  0x48, 0x4f, 0x54, 0x0a,
]);
const syntheticManifestBytes = Buffer.from('synthetic-manifest\n', 'utf8');
const syntheticBindings = Object.freeze({
  apk: Object.freeze({
    bytes: syntheticApkBytes.length,
    mode: 0o444,
    path: '/synthetic/da5-v5/test.apk',
    sha256: createHash('sha256').update(syntheticApkBytes).digest('hex'),
  }),
  manifest: Object.freeze({
    bytes: syntheticManifestBytes.length,
    mode: 0o444,
    path: '/synthetic/da5-v5/test-manifest.txt',
    sha256: createHash('sha256').update(syntheticManifestBytes).digest('hex'),
  }),
});
const validArtifactManifest = `artifact-manifest-version=1
artifact-purpose=da5-v5-read-only-synthetic-android-candidate
product-commit=814cb9013be7da98e46a4c36c5d4e716eef4cf46
product-tree=0181c50faf6936ea1236f4454d536bf734334c91
source-review=APPROVED
source-review-open-p0-p3=0
node-version=24.17.0
npm-version=11.13.0
java-version="17.0.19" 2026-04-21
gradle-version=9.3.1
android-build-tools=36.0.0
artifact-inspector=Android Asset Packaging Tool, v0.2-11948202
dependency-install=npm-ci-offline
expo-network-mode=offline-no-telemetry
gradle-network-mode=offline-init-script
apk-filename=app-release-fd0886dc1c393d3b.apk
apk-sha256=fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96
apk-bytes=95522751
apk-mode=0444
package-name=com.tim180201.mobile.synthetic
version-code=1
version-name=1.0.0
signature-scheme-v1=false
signature-scheme-v2=true
signature-scheme-v3=false
signature-scheme-v3.1=false
signature-scheme-v4=false
signer-count=1
signer-kind=local-synthetic-non-production
signer-certificate-sha256=fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
allow-backup=false
uses-cleartext-traffic=false
network-security-config=taptime_synthetic_e2e_network_security_config
cleartext-boundary=base-deny-with-127.0.0.1-only-exception
full-backup-content=taptime_offline_backup_rules
data-extraction-rules=taptime_offline_data_extraction_rules
offline-backup-exclusions=SecureStore,SQLite,all-databases
nfc-action=android.nfc.action.TECH_DISCOVERED
nfc-category=android.intent.category.DEFAULT
nfc-data=none
nfc-tech-filter=NfcA
nfc-resource-binding=unique-exact
hermes-bundle-count=1
runtime-contract=match
build-marker-offline-storage=1
build-marker-runtime-complete=1
build-marker-apk-ready=1
installation=NOT_RUN
adb=NOT_RUN
human-v5=NOT_RUN
physical-tags=NOT_RUN
external-services=NOT_RUN
accessibility=NOT_RUN
production-signing=NOT_RUN
production=UNAUTHORIZED
production-data=UNAUTHORIZED
deployment=NOT_RUN
distribution=NOT_RUN
artifact-review=PENDING
`;
const syntheticToolAuthority: Da5V5AndroidInspectionToolAuthority =
  Object.freeze({
    aapt: Object.freeze({
      bytes: 2_609_040,
      mode: 0o755,
      path: '/synthetic/android-sdk/build-tools/35.0.0/aapt',
      sha256:
        'c0b5427aeabbbe05023ee2a55e3a9877c99ce57245bb15c21d4802326b86d099',
    }),
    androidSdkPath: '/synthetic/android-sdk',
    apksigner: Object.freeze({
      bytes: 2_959,
      mode: 0o755,
      path: '/synthetic/android-sdk/build-tools/35.0.0/apksigner',
      sha256:
        'b47549e373b895ce6ca620d0c7887e674d9615ffa837a86ac601dcfd04adb0f0',
    }),
    hermesc: Object.freeze({
      bytes: 8_862_552,
      mode: 0o755,
      path:
        '/synthetic/repository/node_modules/hermes-compiler/hermesc/osx-bin/hermesc',
      sha256:
        'c7450cc82978f67052a46dbf8e29ccc4b71107e042154c38907829bf046025be',
    }),
    unzip: Object.freeze({
      bytes: 454_560,
      mode: 0o755,
      path: '/usr/bin/unzip',
      sha256:
        'a07e8b49ac7c1f1fffd8b45544dc69a9cd71a7015f63e6e139c582cff2a56f33',
    }),
  });
const syntheticToolBindings = Object.freeze([
  syntheticToolAuthority.aapt,
  syntheticToolAuthority.apksigner,
  syntheticToolAuthority.hermesc,
  syntheticToolAuthority.unzip,
]);

describe('DA5 V5 immutable external Android artifact', () => {
  it('hard-binds the Product candidate identity', () => {
    expect(DA5_V5_ANDROID_ARTIFACT).toEqual({
      apk: {
        bytes: 95_522_751,
        mode: 0o444,
        path:
          '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/app-release-fd0886dc1c393d3b.apk',
        sha256:
          'fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96',
      },
      manifest: {
        bytes: 1_964,
        mode: 0o444,
        path:
          '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/artifact-manifest.txt',
        sha256:
          'c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639',
      },
      packageName: 'com.tim180201.mobile.synthetic',
      signerCertificateSha256:
        'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
      sourceCommit: '814cb9013be7da98e46a4c36c5d4e716eef4cf46',
      sourceTree: '0181c50faf6936ea1236f4454d536bf734334c91',
      versionCode: '1',
      versionName: '1.0.0',
    });
  });

  it('parses the exact 59-field Product artifact manifest', () => {
    const manifest = verifyDa5V5AndroidArtifactManifest(
      validArtifactManifest,
    );
    expect(Object.keys(manifest)).toHaveLength(59);
    expect(manifest).toMatchObject({
      'apk-filename': 'app-release-fd0886dc1c393d3b.apk',
      'nfc-tech-filter': 'NfcA',
      'product-commit': DA5_V5_ANDROID_ARTIFACT.sourceCommit,
      'product-tree': DA5_V5_ANDROID_ARTIFACT.sourceTree,
      production: 'UNAUTHORIZED',
      'runtime-contract': 'match',
    });
  });

  it.each([
    {
      name: 'missing field',
      source: validArtifactManifest.replace(
        'artifact-review=PENDING\n',
        '',
      ),
    },
    {
      name: 'unknown field',
      source: `${validArtifactManifest}unknown-field=value\n`,
    },
    {
      name: 'duplicate field',
      source: `${validArtifactManifest}artifact-review=PENDING\n`,
    },
    {
      name: 'malformed field',
      source: validArtifactManifest.replace(
        'artifact-review=PENDING',
        'artifact-review PENDING',
      ),
    },
    {
      name: 'noncanonical newline',
      source: validArtifactManifest.replace(/\n/gu, '\r\n'),
    },
  ])('rejects a $name in the Product artifact manifest', ({ source }) => {
    expect(() => verifyDa5V5AndroidArtifactManifest(source))
      .toThrow(/manifest mismatch/u);
  });

  it.each([
    ['product-commit', '0'.repeat(40)],
    ['product-tree', '1'.repeat(40)],
    ['apk-filename', 'stale.apk'],
    ['apk-sha256', '2'.repeat(64)],
    ['apk-bytes', '95522752'],
    ['apk-mode', '0644'],
    ['package-name', 'com.example.stale'],
    ['version-code', '2'],
    ['signature-scheme-v2', 'false'],
    ['signer-certificate-sha256', '3'.repeat(64)],
    ['nfc-action', 'android.nfc.action.TAG_DISCOVERED'],
    ['nfc-tech-filter', 'MifareUltralight'],
    ['runtime-contract', 'mismatch'],
    ['installation', 'COMPLETE'],
    ['production', 'AUTHORIZED'],
    ['artifact-review', 'APPROVED'],
  ])('rejects semantic Product manifest drift in %s', (key, value) => {
    const source = validArtifactManifest.replace(
      new RegExp(`^${key}=.*$`, 'mu'),
      `${key}=${value}`,
    );
    expect(() => verifyDa5V5AndroidArtifactManifest(source))
      .toThrow(/manifest mismatch/u);
  });

  it('constructs only the exact SDK and repository inspection tools', () => {
    expect(createDa5V5AndroidInspectionToolAuthority({
      environment: {
        ANDROID_HOME: '/synthetic/android-sdk',
        ANDROID_SDK_ROOT: '/synthetic/android-sdk',
        NODE_ENV: 'test',
      },
      resolveHermesCompilerPath: () =>
        syntheticToolAuthority.hermesc.path,
    })).toEqual(syntheticToolAuthority);
  });

  it.each([
    { NODE_ENV: 'test' as const },
    { ANDROID_HOME: 'relative-sdk', NODE_ENV: 'test' as const },
    {
      ANDROID_HOME: '/synthetic/android-sdk-a',
      ANDROID_SDK_ROOT: '/synthetic/android-sdk-b',
      NODE_ENV: 'test' as const,
    },
  ])('rejects missing, relative or divergent SDK authority %#', (
    environment,
  ) => {
    expect(() => createDa5V5AndroidInspectionToolAuthority({
      environment,
      resolveHermesCompilerPath: () =>
        syntheticToolAuthority.hermesc.path,
    })).toThrow(/tool authority mismatch/u);
  });

  it('requires the exact profile before any file, SDK or runtime inspection', () => {
    const dependencies = validDependencies();
    for (const profile of [undefined, 'default', 'da4-v5', 'DA5-V5']) {
      expect(() => verifyDa5V5AndroidArtifact({ profile, dependencies })).toThrow(
        /exact explicit profile/,
      );
    }
    expect(dependencies.files.lstat).not.toHaveBeenCalled();
    expect(dependencies.inspectApk).not.toHaveBeenCalled();
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
    expect(requireDa5V5AndroidProfile('da5-v5')).toBe('da5-v5');
  });

  it('matches both immutable files and independently inspected APK boundaries', () => {
    const dependencies = validDependencies();
    expect(verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies,
    })).toEqual({
      packageName: DA5_V5_ANDROID_PACKAGE,
      status: 'match',
      versionCode: '1',
      versionName: '1.0.0',
    });
    expect(dependencies.files.lstat).toHaveBeenCalledTimes(4);
    expect(dependencies.inspectApk).toHaveBeenCalledWith(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
      expect.objectContaining({
        aapt: expect.objectContaining({
          path: syntheticToolAuthority.aapt.path,
        }),
        apksigner: expect.objectContaining({
          path: syntheticToolAuthority.apksigner.path,
        }),
        unzip: expect.objectContaining({
          path: syntheticToolAuthority.unzip.path,
        }),
      }),
    );
    expect(dependencies.verifyRuntime).toHaveBeenCalledWith(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
      expect.objectContaining({
        hermesc: expect.objectContaining({
          path: syntheticToolAuthority.hermesc.path,
        }),
        unzip: expect.objectContaining({
          path: syntheticToolAuthority.unzip.path,
        }),
      }),
    );
    expect(dependencies.reportRuntimeVerified).toHaveBeenCalledTimes(1);
  });

  it('rejects semantic manifest drift before any inspection tool use', () => {
    const dependencies = validDependencies();
    vi.mocked(dependencies.files.readUtf8!).mockReturnValue(
      validArtifactManifest.replace(
        'apk-sha256=fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96',
        `apk-sha256=${'0'.repeat(64)}`,
      ),
    );
    expect(() => verifyDa5V5AndroidArtifact({
      dependencies,
      profile: 'da5-v5',
    })).toThrow(/manifest mismatch/u);
    expect(dependencies.inspectApk).not.toHaveBeenCalled();
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
  });

  it('rejects Product inspection tool substitution before consumer use', () => {
    const dependencies = validDependencies();
    const toolAuthority = {
      ...syntheticToolAuthority,
      aapt: {
        ...syntheticToolAuthority.aapt,
        path: '/synthetic/foreign/aapt',
      },
    };
    expect(() => verifyDa5V5AndroidArtifact({
      dependencies,
      profile: 'da5-v5',
      toolAuthority,
    })).toThrow(/tool authority mismatch/u);
    expect(dependencies.inspectApk).not.toHaveBeenCalled();
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
  });

  it.each([
    'type',
    'symlink',
    'mode',
    'size',
    'digest',
    'realpath',
    'dev',
    'ino',
  ] as const)(
    'rejects pre-use aapt %s drift before the APK consumer',
    (drift) => {
      const dependencies = validDependencies();
      const toolIdentity = dependencies.toolIdentity!;
      let matchingAaptStats = 0;
      vi.mocked(toolIdentity.lstat).mockImplementation((path) => {
        const base = toolIdentityStat(path);
        if (path !== syntheticToolAuthority.aapt.path) return base;
        matchingAaptStats += 1;
        return {
          ...base,
          dev: drift === 'dev' && matchingAaptStats > 1
            ? 16_777_233n
            : base.dev,
          ino: drift === 'ino' && matchingAaptStats > 1
            ? 99n
            : base.ino,
          isFile: () => drift !== 'type',
          isSymbolicLink: () => drift === 'symlink',
          mode: drift === 'mode' ? 0o100700n : base.mode,
          size: drift === 'size'
            ? BigInt(syntheticToolAuthority.aapt.bytes + 1)
            : base.size,
        };
      });
      if (drift === 'digest') {
        vi.mocked(toolIdentity.sha256).mockImplementation((path) => (
          path === syntheticToolAuthority.aapt.path
            ? '0'.repeat(64)
            : toolBinding(path)?.sha256 ?? '0'.repeat(64)
        ));
      }
      if (drift === 'realpath') {
        vi.mocked(toolIdentity.realpath).mockImplementation((path) => (
          path === syntheticToolAuthority.aapt.path
            ? '/synthetic/foreign/aapt'
            : path
        ));
      }

      expect(() => verifyDa5V5AndroidArtifact({
        dependencies,
        profile: 'da5-v5',
      })).toThrow(/tool authority mismatch/u);
      expect(dependencies.inspectApk).not.toHaveBeenCalled();
      expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
    },
  );

  it('rejects equal-size in-place aapt tamper after APK inspection', () => {
    const dependencies = validDependencies();
    let inspectionUsed = false;
    vi.mocked(dependencies.inspectApk).mockImplementation(() => {
      inspectionUsed = true;
      return validInspection();
    });
    vi.mocked(dependencies.toolIdentity!.sha256).mockImplementation(
      (path) => (
        inspectionUsed && path === syntheticToolAuthority.aapt.path
          ? '0'.repeat(64)
          : toolBinding(path)?.sha256 ?? '0'.repeat(64)
      ),
    );

    expect(() => verifyDa5V5AndroidArtifact({
      dependencies,
      profile: 'da5-v5',
    })).toThrow(/tool identity mismatch/u);
    expect(dependencies.inspectApk).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
    expect(dependencies.reportRuntimeVerified).not.toHaveBeenCalled();
  });

  it('rejects hermesc inode drift after runtime use before success output', () => {
    const dependencies = validDependencies();
    let runtimeUsed = false;
    vi.mocked(dependencies.verifyRuntime).mockImplementation(() => {
      runtimeUsed = true;
    });
    vi.mocked(dependencies.toolIdentity!.lstat).mockImplementation((path) => {
      const base = toolIdentityStat(path);
      return path === syntheticToolAuthority.hermesc.path && runtimeUsed
        ? { ...base, ino: 99n }
        : base;
    });

    expect(() => verifyDa5V5AndroidArtifact({
      dependencies,
      profile: 'da5-v5',
    })).toThrow(/tool identity mismatch/u);
    expect(dependencies.verifyRuntime).toHaveBeenCalledTimes(1);
    expect(dependencies.reportRuntimeVerified).not.toHaveBeenCalled();
  });

  it.each([
    'packageName',
    'versionCode',
    'versionName',
    'signatureV1',
    'signatureV2',
    'signatureV3',
    'signatureV31',
    'signatureV4',
    'signerCount',
    'signerCertificateSha256',
    'allowBackup',
    'usesCleartextTraffic',
    'networkSecurityConfig',
    'backupRules',
    'dataExtractionRules',
    'nfcDispatchManifestExact',
    'nfcTechElementCount',
    'nfcTechListCount',
    'hermesBundleCount',
  ] as const)('rejects independent APK inspection drift in %s', (field) => {
    const dependencies = validDependencies();
    const inspection = validInspection();
    const drift: Record<typeof field, unknown> = {
      [field]: typeof inspection[field] === 'boolean'
        ? !inspection[field]
        : typeof inspection[field] === 'number'
          ? inspection[field] + 1
          : `different-${inspection[field]}`,
    } as Record<typeof field, unknown>;
    vi.mocked(dependencies.inspectApk).mockReturnValue({
      ...inspection,
      ...drift,
    } as Da5V5ApkInspection);

    expect(() => verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies,
    })).toThrow('DA5 V5 APK inspection mismatch');
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
  });

  it.each([
    { nfcTechnologies: [] },
    { nfcTechnologies: ['android.nfc.tech.MifareUltralight'] },
    {
      nfcTechnologies: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.MifareUltralight',
      ],
    },
    {
      nfcTechnologies: [
        'android.nfc.tech.NfcA',
        'android.nfc.tech.NfcA',
      ],
    },
  ])('rejects packaged technology-list drift %#', ({ nfcTechnologies }) => {
    const dependencies = validDependencies();
    vi.mocked(dependencies.inspectApk).mockReturnValue({
      ...validInspection(),
      nfcTechnologies,
    });
    expect(() => verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies,
    })).toThrow('DA5 V5 APK inspection mismatch');
  });

  it('parses exactly one compiled NfcA technology list', () => {
    expect(inspectDa5V5NfcTechFilterXmlTree([
      'E: resources (line=1)',
      '  E: tech-list (line=2)',
      '    E: tech (line=3)',
      '      C: "android.nfc.tech.NfcA"',
    ].join('\n'))).toEqual({
      techElementCount: 1,
      techListCount: 1,
      technologies: ['android.nfc.tech.NfcA'],
    });
  });

  it('resolves the exact optimized Product NFC technology filter path', () => {
    const resources = [
      'Package Groups (1)',
      '  Package Group 0 id=0x7f packageCount=1 name=com.tim180201.mobile.synthetic',
      '    spec resource 0x7f110001 com.tim180201.mobile.synthetic:xml/taptime_nfc_tech_filter: flags=0x00000000',
      '    resource 0x7f110001 com.tim180201.mobile.synthetic:xml/taptime_nfc_tech_filter: t=0x03',
      '      (string8) "res/9-3.xml"',
      '    resource 0x7f110002 com.tim180201.mobile.synthetic:xml/unrelated: t=0x03',
      '      (string8) "res/94.xml"',
    ].join('\n');
    expect(resolveDa5V5NfcTechFilterResourceBinding(resources)).toEqual({
      path: 'res/9-3.xml',
      resourceId: '0x7f110001',
    });
    expect(resolveDa5V5NfcTechFilterResourcePath(resources))
      .toBe('res/9-3.xml');
  });

  it.each([
    {
      name: 'missing target',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.synthetic:xml/unrelated: t=0x03',
        '  (string8) "res/93.xml"',
      ].join('\n'),
    },
    {
      name: 'duplicate target records',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.synthetic:xml/taptime_nfc_tech_filter: t=0x03',
        '  (string8) "res/93.xml"',
        'resource 0x7f110002 com.tim180201.mobile.synthetic:xml/taptime_nfc_tech_filter: t=0x03',
        '  (string8) "res/94.xml"',
      ].join('\n'),
    },
    {
      name: 'extra target value',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.synthetic:xml/taptime_nfc_tech_filter: t=0x03',
        '  (string8) "res/93.xml"',
        '  (string8) "res/94.xml"',
      ].join('\n'),
    },
    {
      name: 'unsafe target path',
      resources: [
        'resource 0x7f110001 com.tim180201.mobile.synthetic:xml/taptime_nfc_tech_filter: t=0x03',
        '  (string8) "res/../93.xml"',
      ].join('\n'),
    },
    {
      name: 'foreign package target',
      resources: [
        'resource 0x7f110001 com.example.foreign:xml/taptime_nfc_tech_filter: t=0x03',
        '  (string8) "res/93.xml"',
      ].join('\n'),
    },
  ])('rejects $name in the optimized Product resource table', ({
    resources,
  }) => {
    expect(() => resolveDa5V5NfcTechFilterResourcePath(resources))
      .toThrow(/resource binding mismatch/u);
  });

  it.each([
    {
      name: 'deceptive sibling content',
      tree: [
        'E: resources (line=1)',
        '  E: tech-list (line=2)',
        '    E: tech (line=3)',
        '      C: "android.nfc.tech.MifareUltralight"',
        '  E: unrelated (line=4)',
        '    C: "android.nfc.tech.NfcA"',
      ].join('\n'),
    },
    {
      name: 'technology outside the list',
      tree: [
        'E: resources (line=1)',
        '  E: tech-list (line=2)',
        '  E: tech (line=3)',
        '    C: "android.nfc.tech.NfcA"',
      ].join('\n'),
    },
    {
      name: 'nested technology',
      tree: [
        'E: resources (line=1)',
        '  E: tech-list (line=2)',
        '    E: wrapper (line=3)',
        '      E: tech (line=4)',
        '        C: "android.nfc.tech.NfcA"',
      ].join('\n'),
    },
    {
      name: 'duplicate technology content',
      tree: [
        'E: resources (line=1)',
        '  E: tech-list (line=2)',
        '    E: tech (line=3)',
        '      C: "android.nfc.tech.NfcA"',
        '      C: "android.nfc.tech.NfcA"',
      ].join('\n'),
    },
    {
      name: 'duplicate list',
      tree: [
        'E: resources (line=1)',
        '  E: tech-list (line=2)',
        '    E: tech (line=3)',
        '      C: "android.nfc.tech.NfcA"',
        '  E: tech-list (line=4)',
      ].join('\n'),
    },
    {
      name: 'malformed content indentation',
      tree: [
        'E: resources (line=1)',
        '  E: tech-list (line=2)',
        '    E: tech (line=3)',
        '    C: "android.nfc.tech.NfcA"',
      ].join('\n'),
    },
  ])('does not accept $name as the bound NfcA tree', ({ tree }) => {
    expect(inspectDa5V5NfcTechFilterXmlTree(tree).technologies).toEqual([]);
  });

  it('binds the exact MainActivity dispatch metadata to the resolved NfcA resource id', () => {
    expect(inspectDa5V5ProductManifestXmlTree(
      productNfcManifestXmlTree(),
      '0x7f130008',
    )).toEqual({
      nfcDispatchManifestExact: true,
    });
  });

  it.each([
    {
      name: 'unused exact NfcA resource with wrong manifest reference',
      tree: productNfcManifestXmlTree({
        mainMetadata: [compiledMetadata('0x7f130009')],
      }),
    },
    {
      name: 'duplicate MainActivity',
      tree: productNfcManifestXmlTree({ mainActivityCount: 2 }),
    },
    {
      name: 'duplicate TECH filters',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter(), compiledFilter()],
      }),
    },
    {
      name: 'duplicate TECH metadata',
      tree: productNfcManifestXmlTree({
        mainMetadata: [
          compiledMetadata(),
          compiledMetadata(),
        ],
      }),
    },
    {
      name: 'TECH plus TAG actions',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter({
          actions: [
            'android.nfc.action.TECH_DISCOVERED',
            'android.nfc.action.TAG_DISCOVERED',
          ],
        })],
      }),
    },
    {
      name: 'TAG action',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter({
          actions: ['android.nfc.action.TAG_DISCOVERED'],
        })],
      }),
    },
    {
      name: 'NDEF action',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter({
          actions: ['android.nfc.action.NDEF_DISCOVERED'],
        })],
      }),
    },
    {
      name: 'wrong category',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter({
          categories: ['android.intent.category.BROWSABLE'],
        })],
      }),
    },
    {
      name: 'additional category',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter({
          categories: [
            'android.intent.category.DEFAULT',
            'android.intent.category.BROWSABLE',
          ],
        })],
      }),
    },
    {
      name: 'data element',
      tree: productNfcManifestXmlTree({
        mainFilters: [compiledFilter({ data: true })],
      }),
    },
    {
      name: 'foreign activity dispatch',
      tree: productNfcManifestXmlTree({
        foreignOwners: [{
          filters: [compiledFilter()],
          kind: 'activity',
          metadata: [compiledMetadata()],
          name: `${DA5_V5_ANDROID_PACKAGE}.ForeignActivity`,
        }],
        mainFilters: [],
        mainMetadata: [],
      }),
    },
    {
      name: 'foreign activity metadata',
      tree: productNfcManifestXmlTree({
        foreignOwners: [{
          filters: [],
          kind: 'activity',
          metadata: [compiledMetadata()],
          name: `${DA5_V5_ANDROID_PACKAGE}.ForeignActivity`,
        }],
      }),
    },
    {
      name: 'activity-alias dispatch',
      tree: productNfcManifestXmlTree({
        foreignOwners: [{
          filters: [compiledFilter()],
          kind: 'activity-alias',
          metadata: [compiledMetadata()],
          name: `${DA5_V5_ANDROID_PACKAGE}.ForeignAlias`,
        }],
        mainFilters: [],
        mainMetadata: [],
      }),
    },
  ])('rejects compiled Product manifest drift for $name', ({ tree }) => {
    expect(inspectDa5V5ProductManifestXmlTree(
      tree,
      '0x7f130008',
    )).toEqual({
      nfcDispatchManifestExact: false,
    });
  });

  it('rejects path, type, symlink, mode, size, realpath and digest drift', () => {
    const binding = {
      bytes: 10,
      mode: 0o444,
      path: '/synthetic/exact.apk',
      sha256: 'a'.repeat(64),
    };
    const base = validFileDependencies(binding);
    expect(verifyDa5V5ImmutableFile(binding, base)).toEqual({
      identity: { dev: 1, ino: 1 },
      status: 'match',
    });

    expect(() => verifyDa5V5ImmutableFile(
      { ...binding, path: '/synthetic/../synthetic/exact.apk' },
      base,
    )).toThrow(/canonical/);

    for (const dependency of [
      validFileDependencies(binding, { isFile: false }),
      validFileDependencies(binding, { isSymbolicLink: true }),
      validFileDependencies(binding, { mode: 0o644 }),
      validFileDependencies(binding, { mode: 0o1444 }),
      validFileDependencies(binding, { size: 11 }),
    ]) {
      expect(() => verifyDa5V5ImmutableFile(binding, dependency)).toThrow(/metadata/);
    }
    expect(() => verifyDa5V5ImmutableFile(binding, validFileDependencies(binding, {
      realpath: '/different/exact.apk',
    }))).toThrow(/realpath/);
    expect(() => verifyDa5V5ImmutableFile(binding, validFileDependencies(binding, {
      sha256: 'b'.repeat(64),
    }))).toThrow(/digest/);
  });

  it('detects an inspector-time file swap and rechecks the same inode before install', () => {
    const swapped = validDependencies();
    vi.mocked(swapped.files.lstat)
      .mockImplementationOnce(() => fileStat(1))
      .mockImplementationOnce(() => fileStat(2))
      .mockImplementationOnce(() => fileStat(99))
      .mockImplementationOnce(() => fileStat(2));
    expect(() => verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies: swapped,
    })).toThrow(/identity mismatch/);

    const stable = validDependencies();
    const verification = verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies: stable,
    });
    vi.mocked(stable.files.lstat)
      .mockImplementationOnce(() => fileStat(99))
      .mockImplementationOnce(() => fileStat(2));
    expect(() => reverifyDa5V5AndroidArtifactForInstall(
      verification,
      stable.files,
    )).toThrow(/identity mismatch/);
    expect(stable.files.close).toHaveBeenCalledTimes(1);
    expect(stable.files.readFileDescriptor).not.toHaveBeenCalled();
  });

  it('closes the stable descriptor and zeroes a rejected full-size content snapshot', () => {
    const synthetic = syntheticArtifactVerification();
    const rejectedSnapshot = Buffer.alloc(syntheticApkBytes.length, 0xa5);
    vi.mocked(synthetic.files.readFileDescriptor!).mockReturnValue(
      rejectedSnapshot,
    );

    expect(() => reverifyDa5V5AndroidArtifactForInstall(
      synthetic.verification,
      synthetic.files,
    )).toThrow(/digest mismatch/);

    expect(synthetic.files.close).toHaveBeenCalledTimes(1);
    expectFullBufferZeroized(rejectedSnapshot);
  });

  it('closes the stable descriptor when the descriptor read fails', () => {
    const synthetic = syntheticArtifactVerification();
    vi.mocked(synthetic.files.readFileDescriptor!).mockImplementation(() => {
      throw new Error('synthetic descriptor read failure');
    });

    expect(() => reverifyDa5V5AndroidArtifactForInstall(
      synthetic.verification,
      synthetic.files,
    )).toThrow('synthetic descriptor read failure');
    expect(synthetic.files.close).toHaveBeenCalledTimes(1);
  });

  it(
    'uses the complete synthetic binding through the production digest, single-use and zeroization lifecycle',
    async () => {
      const synthetic = syntheticArtifactVerification();
      const successfulSource = reverifyDa5V5AndroidArtifactForInstall(
        synthetic.verification,
        synthetic.files,
      );
      let successfulSnapshot: Buffer | undefined;
      await expect(successfulSource.use((snapshot) => {
        successfulSnapshot = snapshot;
        expect(snapshot.length).toBe(syntheticBindings.apk.bytes);
        expect(createHash('sha256').update(snapshot).digest('hex')).toBe(
          syntheticBindings.apk.sha256,
        );
        return 'used';
      })).resolves.toBe('used');
      expect(successfulSnapshot).toBeDefined();
      expectFullBufferZeroized(successfulSnapshot!);
      await expect(successfulSource.use(() => 'reused')).rejects.toThrow(
        /snapshot is unavailable/,
      );

      const failingSource = reverifyDa5V5AndroidArtifactForInstall(
        synthetic.verification,
        synthetic.files,
      );
      let failingSnapshot: Buffer | undefined;
      await expect(failingSource.use((snapshot) => {
        failingSnapshot = snapshot;
        throw new Error('synthetic install consumer failure');
      })).rejects.toThrow('synthetic install consumer failure');
      expect(failingSnapshot).toBeDefined();
      expectFullBufferZeroized(failingSnapshot!);
      await expect(failingSource.use(() => 'reused')).rejects.toThrow(
        /snapshot is unavailable/,
      );

      const destroyedSource = reverifyDa5V5AndroidArtifactForInstall(
        synthetic.verification,
        synthetic.files,
      );
      const destroyedSnapshot = synthetic.lastSnapshot();
      destroyedSource.destroy();
      destroyedSource.destroy();
      expectFullBufferZeroized(destroyedSnapshot);
      await expect(destroyedSource.use(() => 'used')).rejects.toThrow(
        /snapshot is unavailable/,
      );

      expect(synthetic.files.openReadOnly).toHaveBeenCalledTimes(3);
      expect(synthetic.files.readFileDescriptor).toHaveBeenCalledTimes(3);
      expect(synthetic.files.close).toHaveBeenCalledTimes(3);
      expect(synthetic.files.fstat).toHaveBeenCalledTimes(6);
    },
  );

  it(
    'zeroes the verified full snapshot if closing its descriptor fails',
    () => {
      const synthetic = syntheticArtifactVerification();
      vi.mocked(synthetic.files.close!).mockImplementation(() => {
        throw new Error('synthetic close failure');
      });

      expect(() => reverifyDa5V5AndroidArtifactForInstall(
        synthetic.verification,
        synthetic.files,
      )).toThrow(/immutable file close failed/);
      expect(synthetic.files.close).toHaveBeenCalledTimes(1);
      expectFullBufferZeroized(synthetic.lastSnapshot());
    },
  );
});

interface CompiledFilterFixture {
  readonly actions: readonly string[];
  readonly categories: readonly string[];
  readonly data: boolean;
}

interface CompiledMetadataFixture {
  readonly name: string;
  readonly resourceId: string;
}

interface CompiledOwnerFixture {
  readonly filters: readonly CompiledFilterFixture[];
  readonly kind: 'activity' | 'activity-alias';
  readonly metadata: readonly CompiledMetadataFixture[];
  readonly name: string;
}

function compiledFilter(options: Readonly<{
  actions?: readonly string[];
  categories?: readonly string[];
  data?: boolean;
}> = {}): CompiledFilterFixture {
  return {
    actions: options.actions
      ?? ['android.nfc.action.TECH_DISCOVERED'],
    categories: options.categories
      ?? ['android.intent.category.DEFAULT'],
    data: options.data ?? false,
  };
}

function compiledMetadata(
  resourceId = '0x7f130008',
  name = 'android.nfc.action.TECH_DISCOVERED',
): CompiledMetadataFixture {
  return { name, resourceId };
}

function productNfcManifestXmlTree(options: Readonly<{
  foreignOwners?: readonly CompiledOwnerFixture[];
  mainActivityCount?: number;
  mainFilters?: readonly CompiledFilterFixture[];
  mainMetadata?: readonly CompiledMetadataFixture[];
}> = {}): string {
  const lines = [
    'E: manifest (line=1)',
    '  E: application (line=2)',
  ];
  for (
    let index = 0;
    index < (options.mainActivityCount ?? 1);
    index += 1
  ) {
    appendCompiledOwner(lines, {
      filters: options.mainFilters ?? [compiledFilter()],
      kind: 'activity',
      metadata: options.mainMetadata ?? [compiledMetadata()],
      name: `${DA5_V5_ANDROID_PACKAGE}.MainActivity`,
    });
  }
  for (const owner of options.foreignOwners ?? []) {
    appendCompiledOwner(lines, owner);
  }
  return lines.join('\n');
}

function appendCompiledOwner(
  lines: string[],
  owner: CompiledOwnerFixture,
): void {
  lines.push(
    `    E: ${owner.kind}`,
    `      A: android:name(0x01010003)="${owner.name}"`,
  );
  for (const filter of owner.filters) {
    lines.push('      E: intent-filter');
    for (const action of filter.actions) {
      lines.push(
        '        E: action',
        `          A: android:name(0x01010003)="${action}"`,
      );
    }
    for (const category of filter.categories) {
      lines.push(
        '        E: category',
        `          A: android:name(0x01010003)="${category}"`,
      );
    }
    if (filter.data) {
      lines.push(
        '        E: data',
        '          A: android:mimeType(0x01010026)="text/plain"',
      );
    }
  }
  for (const metadata of owner.metadata) {
    lines.push(
      '      E: meta-data',
      `        A: android:name(0x01010003)="${metadata.name}"`,
      `        A: android:resource(0x01010025)=@${metadata.resourceId}`,
    );
  }
}

function validDependencies(): Da5V5ArtifactDependencies {
  const files = {
    close: vi.fn(),
    fstat: vi.fn(() => fileStat(1)),
    lstat: vi.fn((path: string) => {
      const binding = path === DA5_V5_ANDROID_ARTIFACT.apk.path
        ? DA5_V5_ANDROID_ARTIFACT.apk
        : DA5_V5_ANDROID_ARTIFACT.manifest;
      return {
        dev: 1,
        ino: path === DA5_V5_ANDROID_ARTIFACT.apk.path ? 1 : 2,
        isFile: () => true,
        isSymbolicLink: () => false,
        mode: binding.mode,
        size: binding.bytes,
      };
    }),
    openReadOnly: vi.fn(() => 42),
    readUtf8: vi.fn(() => validArtifactManifest),
    readFileDescriptor: vi.fn(() => {
      throw new Error('unexpected stable snapshot read');
    }),
    realpath: vi.fn((path: string) => path),
    sha256: vi.fn((path: string) => (
      path === DA5_V5_ANDROID_ARTIFACT.apk.path
        ? DA5_V5_ANDROID_ARTIFACT.apk.sha256
        : DA5_V5_ANDROID_ARTIFACT.manifest.sha256
    )),
  };
  const toolIdentity = validToolIdentityDependencies();
  return {
    files,
    inspectApk: vi.fn(() => validInspection()),
    reportRuntimeVerified: vi.fn(),
    resolveHermesCompilerPath: vi.fn(
      () => syntheticToolAuthority.hermesc.path,
    ),
    toolAuthority: syntheticToolAuthority,
    toolIdentity,
    verifyRuntime: vi.fn(),
  };
}

function validToolIdentityDependencies() {
  return {
    lstat: vi.fn((path: string) => toolIdentityStat(path)),
    realpath: vi.fn((path: string) => path),
    sha256: vi.fn((path: string) =>
      toolBinding(path)?.sha256 ?? '0'.repeat(64)),
  };
}

function toolBinding(path: string) {
  return syntheticToolBindings.find((binding) => binding.path === path);
}

function toolIdentityStat(path: string) {
  const index = syntheticToolBindings.findIndex(
    (binding) => binding.path === path,
  );
  const binding = syntheticToolBindings[index];
  if (binding === undefined) {
    return {
      dev: 1n,
      ino: 99n,
      isFile: () => false,
      isSymbolicLink: () => false,
      mode: 0n,
      size: 0n,
    };
  }
  return {
    dev: 16_777_232n,
    ino: BigInt(index + 11),
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: BigInt(0o100000 | binding.mode),
    size: BigInt(binding.bytes),
  };
}

function validInspection(): Da5V5ApkInspection {
  return {
    allowBackup: false,
    backupRules: true,
    dataExtractionRules: true,
    hermesBundleCount: 1,
    networkSecurityConfig: true,
    nfcTechElementCount: 1,
    nfcTechListCount: 1,
    nfcTechnologies: ['android.nfc.tech.NfcA'],
    nfcDispatchManifestExact: true,
    packageName: DA5_V5_ANDROID_PACKAGE,
    signatureV1: false,
    signatureV2: true,
    signatureV3: false,
    signatureV31: false,
    signatureV4: false,
    signerCertificateSha256: DA5_V5_ANDROID_ARTIFACT.signerCertificateSha256,
    signerCount: 1,
    usesCleartextTraffic: false,
    versionCode: '1',
    versionName: '1.0.0',
  };
}

function validFileDependencies(
  binding: {
    bytes: number;
    mode: number;
    path: string;
    sha256: string;
  },
  drift: Partial<{
    dev: number;
    ino: number;
    isFile: boolean;
    isSymbolicLink: boolean;
    mode: number;
    realpath: string;
    sha256: string;
    size: number;
  }> = {},
): Da5V5FileDependencies {
  return {
    lstat: vi.fn(() => ({
      dev: drift.dev ?? 1,
      ino: drift.ino ?? 1,
      isFile: () => drift.isFile ?? true,
      isSymbolicLink: () => drift.isSymbolicLink ?? false,
      mode: drift.mode ?? binding.mode,
      size: drift.size ?? binding.bytes,
    })),
    realpath: vi.fn(() => drift.realpath ?? binding.path),
    sha256: vi.fn(() => drift.sha256 ?? binding.sha256),
  };
}

function fileStat(ino: number) {
  return {
    dev: 1,
    ino,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o444,
    size: ino === 2
      ? DA5_V5_ANDROID_ARTIFACT.manifest.bytes
      : DA5_V5_ANDROID_ARTIFACT.apk.bytes,
  };
}

function syntheticArtifactVerification(): {
  readonly files: Da5V5FileDependencies;
  lastSnapshot(): Buffer;
  readonly verification: ReturnType<
    typeof createDa5V5AndroidArtifactVerificationForTest
  >;
} {
  let snapshot: Buffer | undefined;
  const files = {
    close: vi.fn(),
    fstat: vi.fn(() => syntheticFileStat(syntheticBindings.apk)),
    lstat: vi.fn((path: string) => syntheticFileStat(
      path === syntheticBindings.apk.path
        ? syntheticBindings.apk
        : syntheticBindings.manifest,
    )),
    openReadOnly: vi.fn(() => 42),
    readFileDescriptor: vi.fn((_fileDescriptor: number, expectedBytes: number) => {
      expect(expectedBytes).toBe(syntheticBindings.apk.bytes);
      snapshot = Buffer.from(syntheticApkBytes);
      return snapshot;
    }),
    realpath: vi.fn((path: string) => path),
    sha256: vi.fn((path: string) => (
      path === syntheticBindings.apk.path
        ? syntheticBindings.apk.sha256
        : syntheticBindings.manifest.sha256
    )),
  } satisfies Da5V5FileDependencies;
  const verification = createDa5V5AndroidArtifactVerificationForTest({
    ...syntheticBindings,
    dependencies: files,
  });
  return {
    files,
    lastSnapshot() {
      if (snapshot === undefined) {
        throw new Error('retained test snapshot is unavailable');
      }
      return snapshot;
    },
    verification,
  };
}

function syntheticFileStat(binding: {
  readonly bytes: number;
  readonly path: string;
}) {
  return {
    dev: 7,
    ino: binding.path === syntheticBindings.apk.path ? 11 : 12,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o444,
    size: binding.bytes,
  };
}

function expectFullBufferZeroized(value: Buffer): void {
  const zeroDigest = createHash('sha256');
  const zeroChunk = Buffer.alloc(1024 * 1024);
  let remaining = value.length;
  while (remaining > 0) {
    const bytes = Math.min(remaining, zeroChunk.length);
    zeroDigest.update(zeroChunk.subarray(0, bytes));
    remaining -= bytes;
  }
  expect(createHash('sha256').update(value).digest('hex')).toBe(
    zeroDigest.digest('hex'),
  );
}
