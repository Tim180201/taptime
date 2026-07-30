import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
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
  verifyDa5V5ImmutableFile,
  type Da5V5ApkInspection,
  type Da5V5ArtifactDependencies,
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

describe('DA5 V5 immutable external Android artifact', () => {
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
    );
    expect(dependencies.verifyRuntime).toHaveBeenCalledWith(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
    );
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
  return {
    files,
    inspectApk: vi.fn(() => validInspection()),
    verifyRuntime: vi.fn(),
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
