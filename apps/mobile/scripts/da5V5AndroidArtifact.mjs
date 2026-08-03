import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  basename,
  join,
  normalize,
  resolve,
} from 'node:path';

import {
  resolveSyntheticE2eHermesCompilerPath,
  verifySyntheticE2eAndroidRuntime,
} from './verifySyntheticE2eAndroidRuntime.mjs';
import {
  assertDa5V5ValidationToolIdentityMetadata,
  verifyDa5V5ValidationToolIdentity,
} from './da5V5ValidationRuntimeContract.mjs';

export const DA5_V5_ANDROID_PROFILE = 'da5-v5';
export const DA5_V5_ANDROID_PACKAGE = 'com.tim180201.mobile.synthetic';
const verifiedArtifacts = new WeakMap();

export const DA5_V5_ANDROID_ARTIFACT = Object.freeze({
  apk: Object.freeze({
    bytes: 95_522_751,
    mode: 0o444,
    path: '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk',
    sha256: 'b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8',
  }),
  manifest: Object.freeze({
    bytes: 1_968,
    mode: 0o444,
    path: '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/artifact-manifest.txt',
    sha256: '83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b',
  }),
  packageName: DA5_V5_ANDROID_PACKAGE,
  signerCertificateSha256:
    'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
  sourceCommit: '83635335aa4f547dc8994243c604dacf9797f593',
  sourceTree: '40b7655a94e607b8afe19f90f42a95f42ee6d582',
  versionCode: '1',
  versionName: '1.0.0',
});
const DA5_V5_ANDROID_TOOL_SPECIFICATIONS = Object.freeze({
  aapt: Object.freeze({
    bytes: 2_609_040,
    mode: 0o755,
    sha256:
      'c0b5427aeabbbe05023ee2a55e3a9877c99ce57245bb15c21d4802326b86d099',
  }),
  apksigner: Object.freeze({
    bytes: 2_959,
    mode: 0o755,
    sha256:
      'b47549e373b895ce6ca620d0c7887e674d9615ffa837a86ac601dcfd04adb0f0',
  }),
  hermesc: Object.freeze({
    bytes: 8_862_552,
    mode: 0o755,
    sha256:
      'c7450cc82978f67052a46dbf8e29ccc4b71107e042154c38907829bf046025be',
  }),
  unzip: Object.freeze({
    bytes: 454_560,
    mode: 0o755,
    sha256:
      'a07e8b49ac7c1f1fffd8b45544dc69a9cd71a7015f63e6e139c582cff2a56f33',
  }),
});
const DA5_V5_ANDROID_TOOL_NAMES = Object.freeze([
  'aapt',
  'apksigner',
  'hermesc',
  'unzip',
]);

export function requireDa5V5AndroidProfile(value) {
  if (value !== DA5_V5_ANDROID_PROFILE) {
    throw new Error('DA5 V5 Android helper requires the exact explicit profile');
  }
  return value;
}

export function createDa5V5AndroidInspectionToolAuthority(options = {}) {
  const environment = options.environment ?? process.env;
  if (
    typeof environment !== 'object'
    || environment === null
    || Array.isArray(environment)
  ) {
    throw new Error('DA5 V5 Android inspection tool authority mismatch');
  }
  const androidHome = environment.ANDROID_HOME;
  const androidSdkRoot = environment.ANDROID_SDK_ROOT;
  if (
    (typeof androidHome !== 'string' || androidHome.length === 0)
    && (typeof androidSdkRoot !== 'string' || androidSdkRoot.length === 0)
  ) {
    throw new Error('DA5 V5 Android inspection tool authority mismatch');
  }
  if (
    typeof androidHome === 'string'
    && androidHome.length > 0
    && typeof androidSdkRoot === 'string'
    && androidSdkRoot.length > 0
    && androidHome !== androidSdkRoot
  ) {
    throw new Error('DA5 V5 Android inspection tool authority mismatch');
  }
  const androidSdkPath = requireCanonicalAndroidToolPath(
    typeof androidHome === 'string' && androidHome.length > 0
      ? androidHome
      : androidSdkRoot,
  );
  const resolveHermesCompilerPath = options.resolveHermesCompilerPath
    ?? resolveSyntheticE2eHermesCompilerPath;
  const hermescPath = requireCanonicalAndroidToolPath(
    resolveHermesCompilerPath(),
  );
  return Object.freeze({
    aapt: createAndroidToolBinding(
      join(androidSdkPath, 'build-tools', '35.0.0', 'aapt'),
      DA5_V5_ANDROID_TOOL_SPECIFICATIONS.aapt,
    ),
    androidSdkPath,
    apksigner: createAndroidToolBinding(
      join(androidSdkPath, 'build-tools', '35.0.0', 'apksigner'),
      DA5_V5_ANDROID_TOOL_SPECIFICATIONS.apksigner,
    ),
    hermesc: createAndroidToolBinding(
      hermescPath,
      DA5_V5_ANDROID_TOOL_SPECIFICATIONS.hermesc,
    ),
    unzip: createAndroidToolBinding(
      '/usr/bin/unzip',
      DA5_V5_ANDROID_TOOL_SPECIFICATIONS.unzip,
    ),
  });
}

export function verifyDa5V5AndroidArtifactManifest(source) {
  if (
    typeof source !== 'string'
    || source.length === 0
    || source.includes('\r')
    || !source.endsWith('\n')
    || source.endsWith('\n\n')
  ) {
    throw new Error('DA5 V5 Android artifact manifest mismatch');
  }
  const expectedEntries = da5V5AndroidArtifactManifestEntries();
  const expected = new Map(expectedEntries);
  const parsed = Object.create(null);
  const lines = source.slice(0, -1).split('\n');
  if (lines.length !== expectedEntries.length) {
    throw new Error('DA5 V5 Android artifact manifest mismatch');
  }
  for (const line of lines) {
    const match = /^([a-z][a-z0-9.-]*)=([^\u0000-\u001f\u007f=]+)$/u
      .exec(line);
    if (
      match === null
      || Object.hasOwn(parsed, match[1])
      || !expected.has(match[1])
      || expected.get(match[1]) !== match[2]
    ) {
      throw new Error('DA5 V5 Android artifact manifest mismatch');
    }
    parsed[match[1]] = match[2];
  }
  if (
    Object.keys(parsed).length !== expectedEntries.length
    || expectedEntries.some(([key]) => !Object.hasOwn(parsed, key))
  ) {
    throw new Error('DA5 V5 Android artifact manifest mismatch');
  }
  return Object.freeze({ ...parsed });
}

function da5V5AndroidArtifactManifestEntries() {
  return Object.freeze([
    ['artifact-manifest-version', '1'],
    ['artifact-purpose', 'da5-v5-read-only-synthetic-android-candidate'],
    ['product-commit', DA5_V5_ANDROID_ARTIFACT.sourceCommit],
    ['product-tree', DA5_V5_ANDROID_ARTIFACT.sourceTree],
    ['source-review', 'APPROVED'],
    ['source-review-open-p0-p3', '0'],
    ['node-version', '24.17.0'],
    ['npm-version', '11.13.0'],
    ['java-version', '"17.0.19" 2026-04-21'],
    ['gradle-version', '9.3.1'],
    ['android-build-tools', '36.0.0'],
    ['artifact-inspector', 'Android Asset Packaging Tool, v0.2-11948202'],
    ['dependency-install', 'npm-ci-task-owned-cache'],
    ['expo-network-mode', 'local-no-telemetry'],
    ['gradle-network-mode', 'task-owned-cache'],
    ['apk-filename', basename(DA5_V5_ANDROID_ARTIFACT.apk.path)],
    ['apk-sha256', DA5_V5_ANDROID_ARTIFACT.apk.sha256],
    ['apk-bytes', String(DA5_V5_ANDROID_ARTIFACT.apk.bytes)],
    [
      'apk-mode',
      DA5_V5_ANDROID_ARTIFACT.apk.mode.toString(8).padStart(4, '0'),
    ],
    ['package-name', DA5_V5_ANDROID_ARTIFACT.packageName],
    ['version-code', DA5_V5_ANDROID_ARTIFACT.versionCode],
    ['version-name', DA5_V5_ANDROID_ARTIFACT.versionName],
    ['signature-scheme-v1', 'false'],
    ['signature-scheme-v2', 'true'],
    ['signature-scheme-v3', 'false'],
    ['signature-scheme-v3.1', 'false'],
    ['signature-scheme-v4', 'false'],
    ['signer-count', '1'],
    ['signer-kind', 'local-synthetic-non-production'],
    [
      'signer-certificate-sha256',
      DA5_V5_ANDROID_ARTIFACT.signerCertificateSha256,
    ],
    ['allow-backup', 'false'],
    ['uses-cleartext-traffic', 'false'],
    [
      'network-security-config',
      'taptime_synthetic_e2e_network_security_config',
    ],
    ['cleartext-boundary', 'base-deny-with-127.0.0.1-only-exception'],
    ['full-backup-content', 'taptime_offline_backup_rules'],
    ['data-extraction-rules', 'taptime_offline_data_extraction_rules'],
    ['offline-backup-exclusions', 'SecureStore,SQLite,all-databases'],
    ['nfc-action', 'android.nfc.action.TECH_DISCOVERED'],
    ['nfc-category', 'android.intent.category.DEFAULT'],
    ['nfc-data', 'none'],
    ['nfc-tech-filter', 'NfcA'],
    ['nfc-resource-binding', 'unique-exact'],
    ['hermes-bundle-count', '1'],
    ['runtime-contract', 'match'],
    ['build-marker-offline-storage', '1'],
    ['build-marker-runtime-complete', '1'],
    ['build-marker-apk-ready', '1'],
    ['installation', 'NOT_RUN'],
    ['adb', 'NOT_RUN'],
    ['human-v5', 'NOT_RUN'],
    ['physical-tags', 'NOT_RUN'],
    ['external-services', 'NOT_RUN'],
    ['accessibility', 'NOT_RUN'],
    ['production-signing', 'NOT_RUN'],
    ['production', 'UNAUTHORIZED'],
    ['production-data', 'UNAUTHORIZED'],
    ['deployment', 'NOT_RUN'],
    ['distribution', 'NOT_RUN'],
    ['artifact-review', 'PENDING'],
  ]);
}

function createAndroidToolBinding(path, specification) {
  return Object.freeze({
    bytes: specification.bytes,
    mode: specification.mode,
    path: requireCanonicalAndroidToolPath(path),
    sha256: specification.sha256,
  });
}

function requireCanonicalAndroidToolPath(path) {
  if (
    typeof path !== 'string'
    || path.length === 0
    || normalize(resolve(path)) !== path
  ) {
    throw new Error('DA5 V5 Android inspection tool authority mismatch');
  }
  return path;
}

function requireDa5V5AndroidToolAuthority(
  authority,
  resolveHermesCompilerPath,
) {
  if (
    typeof authority !== 'object'
    || authority === null
    || Array.isArray(authority)
    || Object.keys(authority).sort().join('\n')
      !== [
        'aapt',
        'androidSdkPath',
        'apksigner',
        'hermesc',
        'unzip',
      ].join('\n')
    || typeof resolveHermesCompilerPath !== 'function'
  ) {
    throw new Error('DA5 V5 Android inspection tool authority mismatch');
  }
  const androidSdkPath = requireCanonicalAndroidToolPath(
    authority.androidSdkPath,
  );
  const expectedPaths = Object.freeze({
    aapt: join(androidSdkPath, 'build-tools', '35.0.0', 'aapt'),
    apksigner: join(
      androidSdkPath,
      'build-tools',
      '35.0.0',
      'apksigner',
    ),
    hermesc: requireCanonicalAndroidToolPath(
      resolveHermesCompilerPath(),
    ),
    unzip: '/usr/bin/unzip',
  });
  for (const name of DA5_V5_ANDROID_TOOL_NAMES) {
    const binding = authority[name];
    const specification = DA5_V5_ANDROID_TOOL_SPECIFICATIONS[name];
    if (
      typeof binding !== 'object'
      || binding === null
      || Array.isArray(binding)
      || Object.keys(binding).sort().join('\n')
        !== ['bytes', 'mode', 'path', 'sha256'].join('\n')
      || binding.bytes !== specification.bytes
      || binding.mode !== specification.mode
      || binding.path !== expectedPaths[name]
      || binding.sha256 !== specification.sha256
    ) {
      throw new Error('DA5 V5 Android inspection tool authority mismatch');
    }
  }
  return authority;
}

function verifyAndroidToolIdentity(binding, dependencies) {
  try {
    return verifyDa5V5ValidationToolIdentity(binding, dependencies);
  } catch {
    throw new Error('DA5 V5 Android inspection tool authority mismatch');
  }
}

function reattestAndroidToolIdentities(identities, dependencies) {
  let mismatch = false;
  for (const identity of identities) {
    try {
      assertDa5V5ValidationToolIdentityMetadata(identity, dependencies);
    } catch {
      mismatch = true;
    }
  }
  if (mismatch) {
    throw new Error('DA5 V5 Android inspection tool identity mismatch');
  }
}

export function verifyDa5V5ImmutableFile(binding, dependencies = systemFileDependencies()) {
  if (
    typeof binding?.path !== 'string'
    || !Number.isSafeInteger(binding.bytes)
    || !Number.isSafeInteger(binding.mode)
    || !/^[0-9a-f]{64}$/.test(binding.sha256)
  ) {
    throw new Error('DA5 V5 immutable file binding is invalid');
  }
  const expectedPath = normalize(resolve(binding.path));
  if (expectedPath !== binding.path) {
    throw new Error('DA5 V5 immutable file path is not canonical');
  }
  const stat = dependencies.lstat(expectedPath);
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || stat.size !== binding.bytes
    || (stat.mode & 0o7777) !== binding.mode
    || !Number.isSafeInteger(stat.dev)
    || !Number.isSafeInteger(stat.ino)
  ) {
    throw new Error('DA5 V5 immutable file metadata mismatch');
  }
  if (normalize(dependencies.realpath(expectedPath)) !== expectedPath) {
    throw new Error('DA5 V5 immutable file realpath mismatch');
  }
  const digest = dependencies.sha256(expectedPath);
  if (digest !== binding.sha256) {
    throw new Error('DA5 V5 immutable file digest mismatch');
  }
  return Object.freeze({
    identity: Object.freeze({ dev: stat.dev, ino: stat.ino }),
    status: 'match',
  });
}

export function verifyDa5V5AndroidArtifact(options = {}) {
  requireDa5V5AndroidProfile(options.profile);
  const dependencies = options.dependencies ?? systemArtifactDependencies();
  const toolAuthority = options.toolAuthority ?? dependencies.toolAuthority;
  const initialApk = verifyDa5V5ImmutableFile(
    DA5_V5_ANDROID_ARTIFACT.apk,
    dependencies.files,
  );
  const initialManifest = verifyDa5V5ImmutableFile(
    DA5_V5_ANDROID_ARTIFACT.manifest,
    dependencies.files,
  );
  if (typeof dependencies.files.readUtf8 !== 'function') {
    throw new Error('DA5 V5 Android artifact manifest reader is unavailable');
  }
  verifyDa5V5AndroidArtifactManifest(
    dependencies.files.readUtf8(DA5_V5_ANDROID_ARTIFACT.manifest.path),
  );
  requireDa5V5AndroidToolAuthority(
    toolAuthority,
    dependencies.resolveHermesCompilerPath,
  );
  const inspectionTools = Object.freeze({
    aapt: verifyAndroidToolIdentity(
      toolAuthority.aapt,
      dependencies.toolIdentity,
    ),
    apksigner: verifyAndroidToolIdentity(
      toolAuthority.apksigner,
      dependencies.toolIdentity,
    ),
    unzip: verifyAndroidToolIdentity(
      toolAuthority.unzip,
      dependencies.toolIdentity,
    ),
  });
  let inspection;
  try {
    inspection = dependencies.inspectApk(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
      inspectionTools,
    );
  } finally {
    reattestAndroidToolIdentities(
      [
        inspectionTools.aapt,
        inspectionTools.apksigner,
        inspectionTools.unzip,
      ],
      dependencies.toolIdentity,
    );
  }
  if (
    inspection.packageName !== DA5_V5_ANDROID_ARTIFACT.packageName
    || inspection.versionCode !== DA5_V5_ANDROID_ARTIFACT.versionCode
    || inspection.versionName !== DA5_V5_ANDROID_ARTIFACT.versionName
    || inspection.signatureV1 !== false
    || inspection.signatureV2 !== true
    || inspection.signatureV3 !== false
    || inspection.signatureV31 !== false
    || inspection.signatureV4 !== false
    || inspection.signerCount !== 1
    || inspection.signerCertificateSha256
      !== DA5_V5_ANDROID_ARTIFACT.signerCertificateSha256
    || inspection.allowBackup !== false
    || inspection.usesCleartextTraffic !== false
    || inspection.networkSecurityConfig !== true
    || inspection.backupRules !== true
    || inspection.dataExtractionRules !== true
    || inspection.nfcDispatchManifestExact !== true
    || inspection.nfcTechListCount !== 1
    || inspection.nfcTechElementCount !== 1
    || !Array.isArray(inspection.nfcTechnologies)
    || inspection.nfcTechnologies.length !== 1
    || inspection.nfcTechnologies[0] !== 'android.nfc.tech.NfcA'
    || inspection.hermesBundleCount !== 1
  ) {
    throw new Error('DA5 V5 APK inspection mismatch');
  }
  const runtimeTools = Object.freeze({
    hermesc: verifyAndroidToolIdentity(
      toolAuthority.hermesc,
      dependencies.toolIdentity,
    ),
    unzip: verifyAndroidToolIdentity(
      toolAuthority.unzip,
      dependencies.toolIdentity,
    ),
  });
  try {
    dependencies.verifyRuntime(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
      runtimeTools,
    );
  } finally {
    reattestAndroidToolIdentities(
      [runtimeTools.unzip, runtimeTools.hermesc],
      dependencies.toolIdentity,
    );
  }
  const inspectedApk = verifyDa5V5ImmutableFile(
    DA5_V5_ANDROID_ARTIFACT.apk,
    dependencies.files,
  );
  const inspectedManifest = verifyDa5V5ImmutableFile(
    DA5_V5_ANDROID_ARTIFACT.manifest,
    dependencies.files,
  );
  requireSameIdentity(initialApk, inspectedApk);
  requireSameIdentity(initialManifest, inspectedManifest);
  dependencies.reportRuntimeVerified?.();
  const result = Object.freeze({
    packageName: DA5_V5_ANDROID_ARTIFACT.packageName,
    status: 'match',
    versionCode: DA5_V5_ANDROID_ARTIFACT.versionCode,
    versionName: DA5_V5_ANDROID_ARTIFACT.versionName,
  });
  verifiedArtifacts.set(result, Object.freeze({
    apk: inspectedApk,
    apkBinding: DA5_V5_ANDROID_ARTIFACT.apk,
    dependencies: dependencies.files,
    manifest: inspectedManifest,
    manifestBinding: DA5_V5_ANDROID_ARTIFACT.manifest,
  }));
  return result;
}

export function createDa5V5AndroidArtifactVerificationForTest(options) {
  if (
    process.env.NODE_ENV !== 'test'
    || process.env.VITEST !== 'true'
  ) {
    throw new Error('DA5 V5 synthetic artifact verification is test-only');
  }
  const apkBinding = Object.freeze({ ...options.apk });
  const manifestBinding = Object.freeze({ ...options.manifest });
  const apk = verifyDa5V5ImmutableFile(apkBinding, options.dependencies);
  const manifest = verifyDa5V5ImmutableFile(
    manifestBinding,
    options.dependencies,
  );
  const result = Object.freeze({
    packageName: DA5_V5_ANDROID_ARTIFACT.packageName,
    status: 'match',
    versionCode: DA5_V5_ANDROID_ARTIFACT.versionCode,
    versionName: DA5_V5_ANDROID_ARTIFACT.versionName,
  });
  verifiedArtifacts.set(result, Object.freeze({
    apk,
    apkBinding,
    dependencies: options.dependencies,
    manifest,
    manifestBinding,
  }));
  return result;
}

export function reverifyDa5V5AndroidArtifactForInstall(
  verification,
  dependencies,
) {
  const sealed = verifiedArtifacts.get(verification);
  if (sealed === undefined) {
    throw new Error('DA5 V5 Android artifact verification is unavailable');
  }
  const files = dependencies ?? sealed.dependencies;
  if (
    typeof files.openReadOnly !== 'function'
    || typeof files.fstat !== 'function'
    || typeof files.readFileDescriptor !== 'function'
    || typeof files.close !== 'function'
  ) {
    throw new Error('DA5 V5 stable artifact file-handle support is unavailable');
  }
  const fileDescriptor = files.openReadOnly(sealed.apkBinding.path);
  let snapshot;
  try {
    const openedBefore = files.fstat(fileDescriptor);
    requireDa5V5FileMetadata(openedBefore, sealed.apkBinding);
    const openedApk = Object.freeze({
      identity: Object.freeze({ dev: openedBefore.dev, ino: openedBefore.ino }),
      status: 'match',
    });
    const apkAtPath = verifyDa5V5ImmutableFile(
      sealed.apkBinding,
      files,
    );
    const manifest = verifyDa5V5ImmutableFile(
      sealed.manifestBinding,
      files,
    );
    requireSameIdentity(sealed.apk, openedApk);
    requireSameIdentity(openedApk, apkAtPath);
    requireSameIdentity(sealed.manifest, manifest);
    snapshot = files.readFileDescriptor(
      fileDescriptor,
      sealed.apkBinding.bytes,
    );
    if (
      !Buffer.isBuffer(snapshot)
      || snapshot.length !== sealed.apkBinding.bytes
      || createHash('sha256').update(snapshot).digest('hex')
        !== sealed.apkBinding.sha256
    ) {
      throw new Error('DA5 V5 immutable file digest mismatch');
    }
    const openedAfter = files.fstat(fileDescriptor);
    requireDa5V5FileMetadata(openedAfter, sealed.apkBinding);
    requireSameIdentity(
      openedApk,
      {
        identity: Object.freeze({
          dev: openedAfter.dev,
          ino: openedAfter.ino,
        }),
      },
    );
  } catch (error) {
    snapshot?.fill(0);
    try {
      files.close(fileDescriptor);
    } catch {
      throw new Error('DA5 V5 immutable file close failed');
    }
    throw error;
  }
  try {
    files.close(fileDescriptor);
  } catch {
    snapshot.fill(0);
    throw new Error('DA5 V5 immutable file close failed');
  }
  let destroyed = false;
  let used = false;
  return Object.freeze({
    destroy() {
      if (!destroyed) {
        destroyed = true;
        snapshot.fill(0);
      }
    },
    status: 'match',
    async use(operation) {
      if (destroyed || used || typeof operation !== 'function') {
        throw new Error('DA5 V5 verified APK snapshot is unavailable');
      }
      used = true;
      try {
        return await operation(snapshot);
      } finally {
        destroyed = true;
        snapshot.fill(0);
      }
    },
  });
}

function requireSameIdentity(expected, actual) {
  if (
    expected.identity.dev !== actual.identity.dev
    || expected.identity.ino !== actual.identity.ino
  ) {
    throw new Error('DA5 V5 immutable file identity mismatch');
  }
}

function requireDa5V5FileMetadata(stat, binding) {
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || stat.size !== binding.bytes
    || (stat.mode & 0o7777) !== binding.mode
    || !Number.isSafeInteger(stat.dev)
    || !Number.isSafeInteger(stat.ino)
  ) {
    throw new Error('DA5 V5 immutable file metadata mismatch');
  }
}

function systemFileDependencies() {
  return Object.freeze({
    close: closeSync,
    fstat: fstatSync,
    lstat: lstatSync,
    openReadOnly(path) {
      return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    },
    readFileDescriptor(fileDescriptor, expectedBytes) {
      const snapshot = Buffer.allocUnsafe(expectedBytes);
      const excess = Buffer.allocUnsafe(1);
      try {
        let offset = 0;
        while (offset < expectedBytes) {
          const bytesRead = readSync(
            fileDescriptor,
            snapshot,
            offset,
            expectedBytes - offset,
            offset,
          );
          if (bytesRead === 0) {
            throw new Error('DA5 V5 immutable file ended before its bound size');
          }
          offset += bytesRead;
        }
        if (readSync(fileDescriptor, excess, 0, 1, offset) !== 0) {
          throw new Error('DA5 V5 immutable file exceeded its bound size');
        }
        return snapshot;
      } catch (error) {
        snapshot.fill(0);
        throw error;
      } finally {
        excess.fill(0);
      }
    },
    readUtf8(path) {
      return readFileSync(path, 'utf8');
    },
    realpath: realpathSync,
    sha256(path) {
      return createHash('sha256').update(readFileSync(path)).digest('hex');
    },
  });
}

function systemArtifactDependencies() {
  const toolAuthority = createDa5V5AndroidInspectionToolAuthority();
  return Object.freeze({
    files: systemFileDependencies(),
    inspectApk(apkPath, tools) {
      const badging = runText(
        tools.aapt.path,
        ['dump', 'badging', apkPath],
      );
      const manifest = runText(
        tools.aapt.path,
        ['dump', 'xmltree', apkPath, 'AndroidManifest.xml'],
      );
      const resources = runText(
        tools.aapt.path,
        ['dump', '--values', 'resources', apkPath],
      );
      const nfcTechFilterBinding =
        resolveDa5V5NfcTechFilterResourceBinding(resources);
      const nfcTechFilter = inspectDa5V5NfcTechFilterXmlTree(
        runText(
          tools.aapt.path,
          [
            'dump',
            'xmltree',
            apkPath,
            nfcTechFilterBinding.path,
          ],
        ),
      );
      const nfcDispatchManifest =
        inspectDa5V5ProductManifestXmlTree(
          manifest,
          nfcTechFilterBinding.resourceId,
        );
      const signature = runText(
        tools.apksigner.path,
        ['verify', '--verbose', '--print-certs', apkPath],
      );
      const entries = runText(tools.unzip.path, ['-Z1', apkPath])
        .split(/\r?\n/u)
        .filter((entry) => entry.length !== 0);
      const compiledXmlStrings = asciiStrings(
        runBinary(tools.unzip.path, ['-p', apkPath, 'res/*.xml']),
      );
      const packageMatch =
        /^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m.exec(badging);
      if (packageMatch === null) {
        throw new Error('DA5 V5 APK package metadata is unavailable');
      }
      return Object.freeze({
        allowBackup: !/android:allowBackup[^\n]*\(type 0x12\)0x0/u.test(manifest),
        backupRules: (
          manifest.includes('android:fullBackupContent')
          && resources.includes(':xml/taptime_offline_backup_rules')
          && compiledXmlStrings.includes('database')
          && compiledXmlStrings.includes('sharedpref')
          && compiledXmlStrings.includes('exclude')
        ),
        dataExtractionRules: (
          manifest.includes('android:dataExtractionRules')
          && resources.includes(':xml/taptime_offline_data_extraction_rules')
        ),
        hermesBundleCount: entries.filter(
          (entry) => entry === 'assets/index.android.bundle',
        ).length,
        networkSecurityConfig: (
          manifest.includes('android:networkSecurityConfig')
          && resources.includes(':xml/taptime_synthetic_e2e_network_security_config')
          && compiledXmlStrings.includes('127.0.0.1')
          && compiledXmlStrings.includes('cleartextTrafficPermitted')
        ),
        nfcTechElementCount: nfcTechFilter.techElementCount,
        nfcTechListCount: nfcTechFilter.techListCount,
        nfcTechnologies: nfcTechFilter.technologies,
        nfcDispatchManifestExact:
          nfcDispatchManifest.nfcDispatchManifestExact,
        packageName: packageMatch[1],
        signatureV1: signatureValue(signature, 'v1 scheme (JAR signing)'),
        signatureV2: signatureValue(signature, 'v2 scheme (APK Signature Scheme v2)'),
        signatureV3: signatureValue(signature, 'v3 scheme (APK Signature Scheme v3)'),
        signatureV31: signatureValue(signature, 'v3.1 scheme (APK Signature Scheme v3.1)'),
        signatureV4: signatureValue(signature, 'v4 scheme (APK Signature Scheme v4)'),
        signerCertificateSha256: requiredMatch(
          signature,
          /^Signer #1 certificate SHA-256 digest: ([0-9a-f]{64})$/m,
        ),
        signerCount: Number(requiredMatch(signature, /^Number of signers: ([0-9]+)$/m)),
        usesCleartextTraffic:
          !/android:usesCleartextTraffic[^\n]*\(type 0x12\)0x0/u.test(manifest),
        versionCode: packageMatch[2],
        versionName: packageMatch[3],
      });
    },
    reportRuntimeVerified() {
      process.stdout.write(
        'synthetic_e2e_android_runtime_complete_verified\n',
      );
    },
    resolveHermesCompilerPath:
      resolveSyntheticE2eHermesCompilerPath,
    toolAuthority,
    verifyRuntime(apkPath, tools) {
      verifySyntheticE2eAndroidRuntime(apkPath, {
        emitSuccess: false,
        hermesCompilerPath: tools.hermesc.path,
        unzipPath: tools.unzip.path,
      });
    },
  });
}

export function resolveDa5V5NfcTechFilterResourceBinding(resources) {
  if (typeof resources !== 'string') {
    throw new Error('DA5 V5 NFC technology filter resource binding mismatch');
  }
  const paths = [];
  let resourceId;
  let targetResource = false;
  let targetResourceCount = 0;
  for (const line of resources.split(/\r?\n/u)) {
    const resource = /^\s*resource\s+(0x[0-9a-f]{8})\s+([A-Za-z0-9._]+):xml\/([A-Za-z0-9_]+):(?:\s+.*)?$/u
      .exec(line);
    if (resource !== null) {
      targetResource = (
        resource[2] === DA5_V5_ANDROID_PACKAGE
        && resource[3] === 'taptime_nfc_tech_filter'
      );
      if (targetResource) {
        targetResourceCount += 1;
        resourceId = resource[1];
      }
      continue;
    }
    if (/^\s*(?:spec\s+)?resource\s+/u.test(line)) {
      targetResource = false;
      continue;
    }
    if (targetResource) {
      const value = /^\s*\(string8\)\s+"([^"]+)"\s*$/u.exec(line);
      if (value !== null) {
        paths.push(value[1]);
      }
    }
  }
  if (
    targetResourceCount !== 1
    || resourceId === undefined
    || paths.length !== 1
    || !/^res\/[A-Za-z0-9_-]+\.xml$/u.test(paths[0])
  ) {
    throw new Error('DA5 V5 NFC technology filter resource binding mismatch');
  }
  return Object.freeze({
    path: paths[0],
    resourceId,
  });
}

export function resolveDa5V5NfcTechFilterResourcePath(resources) {
  return resolveDa5V5NfcTechFilterResourceBinding(resources).path;
}

export function inspectDa5V5ProductManifestXmlTree(
  xmlTree,
  expectedResourceId,
) {
  if (
    typeof xmlTree !== 'string'
    || xmlTree.length === 0
    || typeof expectedResourceId !== 'string'
    || !/^0x[0-9a-f]{8}$/u.test(expectedResourceId)
  ) {
    throw new Error('DA5 V5 Product NFC manifest binding is unavailable');
  }
  const roots = parseDa5V5AaptXmlTree(xmlTree);
  const manifests = roots.filter((node) => node.name === 'manifest');
  const applications = manifests.length === 1
    ? manifests[0].children.filter((node) => node.name === 'application')
    : [];
  const application = applications[0];
  const owners = application?.children.filter((node) => (
    node.name === 'activity' || node.name === 'activity-alias'
  )) ?? [];
  const mainActivityName = `${DA5_V5_ANDROID_PACKAGE}.MainActivity`;
  const mainActivities = owners.filter((node) => (
    node.name === 'activity'
    && exactDa5V5AaptStringAttribute(node, 'android:name')
      === mainActivityName
  ));
  const mainActivity = mainActivities[0];
  const nfcActions = owners.flatMap((owner) =>
    da5V5AaptDescendants(owner)
      .filter((node) => (
        node.name === 'action'
        && da5V5AaptStringAttributeValues(node, 'android:name')
          .some((value) => value.startsWith('android.nfc.action.'))
      ))
      .map((action) => Object.freeze({ action, owner })));
  const metadataBindings = owners.flatMap((owner) =>
    da5V5AaptDescendants(owner)
      .filter((node) => {
        if (node.name !== 'meta-data') return false;
        return (
          da5V5AaptStringAttributeValues(node, 'android:name')
            .some((value) => value.startsWith('android.nfc.action.'))
          || da5V5AaptResourceAttributeValues(
            node,
            'android:resource',
          ).includes(expectedResourceId)
        );
      })
      .map((metadata) => Object.freeze({ metadata, owner })));
  const nfcAction = nfcActions[0];
  const filter = nfcAction?.action.parent;
  const metadata = metadataBindings[0];
  const exact = (
    roots.length === 1
    && manifests.length === 1
    && applications.length === 1
    && mainActivities.length === 1
    && nfcActions.length === 1
    && nfcAction.owner === mainActivity
    && filter?.name === 'intent-filter'
    && filter.parent === mainActivity
    && isExactDa5V5CompiledNfcFilter(filter)
    && metadataBindings.length === 1
    && metadata.owner === mainActivity
    && metadata.metadata.parent === mainActivity
    && isExactDa5V5CompiledNfcMetadata(
      metadata.metadata,
      expectedResourceId,
    )
  );
  return Object.freeze({
    nfcDispatchManifestExact: exact,
  });
}

function parseDa5V5AaptXmlTree(xmlTree) {
  const roots = [];
  const stack = [];
  for (const line of xmlTree.split(/\r?\n/u)) {
    const element = /^( *)E:\s+([A-Za-z0-9_-]+)(?:\s|$)/u.exec(line);
    if (element !== null) {
      const indent = element[1].length;
      while (stack.at(-1)?.indent >= indent) {
        stack.pop();
      }
      const parent = stack.at(-1) ?? null;
      const node = {
        attributes: [],
        children: [],
        indent,
        name: element[2],
        parent,
      };
      if (parent === null) {
        roots.push(node);
      } else {
        parent.children.push(node);
      }
      stack.push(node);
      continue;
    }
    const attribute =
      /^( *)A:\s+([A-Za-z0-9_.:-]+)(?:\([^)\r\n]*\))?=(.*)$/u
        .exec(line);
    const owner = stack.at(-1);
    if (
      attribute === null
      || owner === undefined
      || attribute[1].length <= owner.indent
    ) {
      continue;
    }
    const rawValue = attribute[3];
    const stringValue = /^"([^"]*)"/u.exec(rawValue)?.[1];
    const resourceValue = /^@(0x[0-9a-f]{8})(?:\s|$)/u
      .exec(rawValue)?.[1];
    owner.attributes.push({
      kind: stringValue !== undefined
        ? 'string'
        : resourceValue !== undefined
          ? 'resource'
          : 'other',
      name: attribute[2],
      value: stringValue ?? resourceValue ?? rawValue,
    });
  }
  return roots;
}

function da5V5AaptDescendants(node) {
  const descendants = [];
  const pending = [...node.children];
  while (pending.length > 0) {
    const candidate = pending.shift();
    descendants.push(candidate);
    pending.unshift(...candidate.children);
  }
  return descendants;
}

function da5V5AaptStringAttributeValues(node, name) {
  return node.attributes
    .filter((attribute) => (
      attribute.name === name && attribute.kind === 'string'
    ))
    .map((attribute) => attribute.value);
}

function da5V5AaptResourceAttributeValues(node, name) {
  return node.attributes
    .filter((attribute) => (
      attribute.name === name && attribute.kind === 'resource'
    ))
    .map((attribute) => attribute.value);
}

function exactDa5V5AaptStringAttribute(node, name) {
  const values = da5V5AaptStringAttributeValues(node, name);
  return values.length === 1 ? values[0] : null;
}

function isExactDa5V5CompiledNfcFilter(filter) {
  const actions = filter.children.filter((node) => node.name === 'action');
  const categories = filter.children.filter(
    (node) => node.name === 'category',
  );
  return (
    filter.attributes.length === 0
    && filter.children.length === 2
    && actions.length === 1
    && isExactDa5V5CompiledNamedElement(
      actions[0],
      'android.nfc.action.TECH_DISCOVERED',
    )
    && categories.length === 1
    && isExactDa5V5CompiledNamedElement(
      categories[0],
      'android.intent.category.DEFAULT',
    )
  );
}

function isExactDa5V5CompiledNamedElement(node, value) {
  return (
    node.children.length === 0
    && node.attributes.length === 1
    && exactDa5V5AaptStringAttribute(node, 'android:name') === value
  );
}

function isExactDa5V5CompiledNfcMetadata(metadata, expectedResourceId) {
  return (
    metadata.children.length === 0
    && metadata.attributes.length === 2
    && exactDa5V5AaptStringAttribute(metadata, 'android:name')
      === 'android.nfc.action.TECH_DISCOVERED'
    && da5V5AaptResourceAttributeValues(
      metadata,
      'android:resource',
    ).length === 1
    && da5V5AaptResourceAttributeValues(
      metadata,
      'android:resource',
    )[0] === expectedResourceId
  );
}

export function inspectDa5V5NfcTechFilterXmlTree(xmlTree) {
  if (typeof xmlTree !== 'string' || xmlTree.length === 0) {
    throw new Error('DA5 V5 NFC technology filter is unavailable');
  }
  const elements = [];
  const contents = [];
  const stack = [];
  for (const line of xmlTree.split(/\r?\n/u)) {
    const element = /^( *)E:\s+([A-Za-z0-9_-]+)(?:\s|$)/u.exec(line);
    if (element !== null) {
      const indent = element[1].length;
      while (stack.at(-1)?.indent >= indent) {
        stack.pop();
      }
      const node = {
        children: [],
        indent,
        name: element[2],
        parent: stack.at(-1) ?? null,
      };
      node.parent?.children.push(node);
      elements.push(node);
      stack.push(node);
      continue;
    }
    const content = /^( *)C:\s+"([^"]*)"\s*$/u.exec(line);
    if (content !== null) {
      const indent = content[1].length;
      while (stack.at(-1)?.indent >= indent) {
        stack.pop();
      }
      contents.push({
        parent: stack.at(-1) ?? null,
        value: content[2],
      });
    }
  }
  const roots = elements.filter((element) => element.parent === null);
  const techLists = elements.filter((element) => element.name === 'tech-list');
  const techElements = elements.filter((element) => element.name === 'tech');
  const techList = techLists[0];
  const tech = techElements[0];
  const techContents = contents.filter((content) => content.parent === tech);
  const exactHierarchy = (
    roots.length === 1
    && roots[0].name === 'resources'
    && roots[0].children.length === 1
    && roots[0].children[0] === techList
    && techLists.length === 1
    && techList?.parent === roots[0]
    && techList.children.length === 1
    && techList.children[0] === tech
    && techElements.length === 1
    && tech?.parent === techList
    && tech.children.length === 0
    && contents.length === 1
    && techContents.length === 1
  );
  const technologies = exactHierarchy
    ? [techContents[0].value]
    : [];
  return Object.freeze({
    techElementCount: techElements.length,
    techListCount: techLists.length,
    technologies: Object.freeze(technologies),
  });
}

function signatureValue(output, label) {
  return requiredMatch(
    output,
    new RegExp(`^Verified using ${escapeRegExp(label)}: (true|false)$`, 'm'),
  ) === 'true';
}

function requiredMatch(value, pattern) {
  const result = pattern.exec(value)?.[1];
  if (result === undefined) {
    throw new Error('DA5 V5 APK inspection output is incomplete');
  }
  return result;
}

function asciiStrings(buffer) {
  const latin = buffer.toString('latin1').match(/[\x20-\x7e]{4,}/g)?.join('\n') ?? '';
  const utf16 = buffer.toString('utf16le').match(/[\x20-\x7e]{4,}/g)?.join('\n') ?? '';
  return `${latin}\n${utf16}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runText(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || result.error !== undefined) {
    throw new Error('DA5 V5 APK inspection command failed');
  }
  return result.stdout;
}

function runBinary(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || result.error !== undefined) {
    throw new Error('DA5 V5 APK inspection command failed');
  }
  return result.stdout;
}
