import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  dirname,
  join,
  normalize,
  resolve,
} from 'node:path';

import {
  DA5_V5_VALIDATION_ENTRY_FILE,
  DA5_V5_VALIDATION_RUNTIME_MARKER,
  DA5_V5_VALIDATION_RUNTIME_VARIANT,
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
} from './da5V5ValidationRuntimeContract.mjs';
import {
  DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE,
  DA5_V5_VALIDATION_NATIVE_SOURCE_CONTRACT,
} from './da5V5ValidationNativeSourceBinding.mjs';

export const DA5_V5_VALIDATION_ARTIFACT_CONTRACT =
  'taptime-da5-v5-validation-artifact-v1';
export const DA5_V5_VALIDATION_PACKAGE =
  'com.tim180201.mobile.validation';
export const DA5_V5_VALIDATION_VERSION_CODE = '1';
export const DA5_V5_VALIDATION_VERSION_NAME = '1.0.0';
export const DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256 =
  'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';
export const DA5_V5_VALIDATION_TECHNOLOGY =
  'NfcA+MifareUltralight';

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const REQUIRED_NATIVE_BYTECODE_MARKERS = Object.freeze([
  'com/taptime/da5validationbinding/Da5V5ValidationDeviceBindingModule',
  'community/revteltech/nfc/NfcManagerPackage',
  'expo/modules/ExpoModulesPackage',
  'expo/modules/crypto/CryptoModule',
]);
const FORBIDDEN_NATIVE_BYTECODE_MARKERS = Object.freeze([
  'com/taptime/monotonicclock/TapTimeMonotonicClockModule',
  'com/taptime/nfcingress/TapTimeNfcIngressModule',
  'expo/modules/asset/AssetModule',
  'expo/modules/backgroundtask/BackgroundTaskModule',
  'expo/modules/constants/ConstantsModule',
  'expo/modules/devlauncher/DevLauncherPackage',
  'expo/modules/devmenu/DevMenuPackage',
  'expo/modules/filesystem/FileSystemModule',
  'expo/modules/font/FontLoaderModule',
  'expo/modules/keepawake/KeepAwakeModule',
  'expo/modules/network/NetworkModule',
  'expo/modules/securestore/SecureStoreModule',
  'expo/modules/sqlite/SQLiteModule',
  'expo/modules/taskManager/TaskManagerModule',
]);
const EXACT_MANIFEST_KEYS = Object.freeze([
  'allowBackup',
  'apkBytes',
  'apkMode',
  'apkSha256',
  'artifactContract',
  'backupPolicy',
  'cleartextTraffic',
  'entryFile',
  'networkPolicy',
  'nativeSourceBytes',
  'nativeSourceContract',
  'nativeSourceDirectories',
  'nativeSourceEntries',
  'nativeSourceFiles',
  'nativeSourceSha256',
  'packageName',
  'permissions',
  'productDeepLinks',
  'productTagDispatch',
  'runtimeMarker',
  'runtimeVariant',
  'signerCertificateSha256',
  'signingScope',
  'sourceCommit',
  'sourceClosure',
  'sourceTree',
  'technology',
  'versionCode',
  'versionName',
]);

export function createDa5V5ValidationArtifactManifest({
  apkBytes,
  apkSha256,
  sourceCommit,
  sourceClosure,
  sourceTree,
}) {
  requirePositiveSafeInteger(apkBytes, 'APK byte size');
  requireSha256(apkSha256, 'APK SHA-256');
  requireGitObject(sourceCommit, 'source commit');
  requireGitObject(sourceTree, 'source tree');
  const normalizedSourceClosure = normalizeSourceClosure(sourceClosure);
  return Object.freeze({
    allowBackup: false,
    apkBytes,
    apkMode: '0444',
    apkSha256,
    artifactContract: DA5_V5_VALIDATION_ARTIFACT_CONTRACT,
    backupPolicy: 'deny-all-cloud-and-device-transfer',
    cleartextTraffic: false,
    entryFile: DA5_V5_VALIDATION_ENTRY_FILE,
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
    packageName: DA5_V5_VALIDATION_PACKAGE,
    permissions: 'android.permission.NFC-only',
    productDeepLinks: false,
    productTagDispatch: false,
    runtimeMarker: DA5_V5_VALIDATION_RUNTIME_MARKER,
    runtimeVariant: DA5_V5_VALIDATION_RUNTIME_VARIANT,
    signerCertificateSha256:
      DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
    signingScope: 'local-validation-only',
    sourceCommit,
    sourceClosure: normalizedSourceClosure,
    sourceTree,
    technology: DA5_V5_VALIDATION_TECHNOLOGY,
    versionCode: DA5_V5_VALIDATION_VERSION_CODE,
    versionName: DA5_V5_VALIDATION_VERSION_NAME,
  });
}

export function serializeDa5V5ValidationArtifactManifest(manifest) {
  verifyManifestShape(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function verifyDa5V5ValidationArtifactBinding(
  options,
  dependencies = systemDependencies(),
) {
  requireGitObject(options?.expectedSourceCommit, 'expected source commit');
  requireGitObject(options?.expectedSourceTree, 'expected source tree');
  const expectedSourceClosure = normalizeSourceClosure(
    options?.expectedSourceClosure,
  );
  const apk = verifyImmutableFile(options?.apk, dependencies.files);
  verifyImmutableFile(options?.manifest, dependencies.files);
  const manifest = parseManifest(
    dependencies.files.readUtf8(options.manifest.path),
  );
  verifyManifestShape(manifest);
  if (
    manifest.sourceCommit !== options.expectedSourceCommit
    || manifest.sourceTree !== options.expectedSourceTree
    || JSON.stringify(manifest.sourceClosure)
      !== JSON.stringify(expectedSourceClosure)
    || manifest.apkBytes !== options.apk.bytes
    || manifest.apkSha256 !== options.apk.sha256
    || manifest.apkMode !== modeText(options.apk.mode)
  ) {
    throw new Error('DA5 V5 Validation source/artifact binding mismatch');
  }
  const inspection = dependencies.inspectApk(options.apk.path);
  verifyDa5V5ValidationApkInspection(inspection);
  verifyImmutableFile(options.apk, dependencies.files, apk.identity);
  verifyImmutableFile(options.manifest, dependencies.files);
  return Object.freeze({
    packageName: DA5_V5_VALIDATION_PACKAGE,
    sourceCommit: options.expectedSourceCommit,
    sourceClosure: expectedSourceClosure,
    sourceTree: options.expectedSourceTree,
    status: 'match',
  });
}

export function verifyDa5V5ValidationApkInspection(inspection) {
  if (
    inspection?.packageName !== DA5_V5_VALIDATION_PACKAGE
    || inspection.versionCode !== DA5_V5_VALIDATION_VERSION_CODE
    || inspection.versionName !== DA5_V5_VALIDATION_VERSION_NAME
    || inspection.signatureV1 !== false
    || inspection.signatureV2 !== true
    || inspection.signatureV3 !== false
    || inspection.signatureV31 !== false
    || inspection.signatureV4 !== false
    || inspection.signerCount !== 1
    || inspection.signerCertificateSha256
      !== DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256
    || !Array.isArray(inspection.permissions)
    || inspection.permissions.length !== 1
    || inspection.permissions[0] !== 'android.permission.NFC'
    || inspection.nfcFeatureRequired !== true
    || inspection.allowBackup !== false
    || inspection.backupPolicyDenyAll !== true
    || inspection.cleartextTraffic !== false
    || inspection.networkSecurityConfig !== true
    || inspection.networkPolicyDenyAll !== true
    || inspection.productDeepLinks !== false
    || inspection.productTagDispatch !== false
    || inspection.requiredNativeModules !== true
    || inspection.forbiddenNativeModules !== false
    || inspection.hermesBundleCount !== 1
    || inspection.validationRuntimeMarker !== true
    || inspection.productRuntimeMarker !== false
  ) {
    throw new Error('DA5 V5 Validation APK boundary mismatch');
  }
  return Object.freeze({ status: 'match' });
}

export function resolveDa5V5ValidationPackagedXmlPath(
  resources,
  resourceName,
) {
  if (
    typeof resources !== 'string'
    || ![
      'taptime_da5_v5_validation_data_extraction_rules',
      'taptime_da5_v5_validation_network_security',
    ].includes(resourceName)
  ) {
    throw new Error(
      'DA5 V5 Validation packaged XML resource binding mismatch',
    );
  }
  const paths = [];
  let targetResource = false;
  for (const line of resources.split(/\r?\n/u)) {
    const resource = /^\s*resource\s+0x[0-9a-f]{8}\s+[A-Za-z0-9._]+:xml\/([A-Za-z0-9_]+):(?:\s+.*)?$/u
      .exec(line);
    if (resource !== null) {
      targetResource = resource[1] === resourceName;
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
    paths.length !== 1
    || !/^res\/[A-Za-z0-9_]+\.xml$/u.test(paths[0])
  ) {
    throw new Error(
      'DA5 V5 Validation packaged XML resource binding mismatch',
    );
  }
  return paths[0];
}

export function inspectDa5V5ValidationApk(
  apkPath,
  environment = process.env,
) {
  const androidHome = environment.ANDROID_HOME
    ?? environment.ANDROID_SDK_ROOT;
  if (typeof androidHome !== 'string' || androidHome.length === 0) {
    throw new Error('DA5 V5 Validation Android SDK path is unavailable');
  }
  const aapt = join(androidHome, 'build-tools', '35.0.0', 'aapt');
  const apksigner = join(
    androidHome,
    'build-tools',
    '35.0.0',
    'apksigner',
  );
  const badging = runText(aapt, ['dump', 'badging', apkPath]);
  const androidManifest = runText(
    aapt,
    ['dump', 'xmltree', apkPath, 'AndroidManifest.xml'],
  );
  const resources = runText(
    aapt,
    ['dump', '--values', 'resources', apkPath],
  );
  const networkPolicyPath = resolveDa5V5ValidationPackagedXmlPath(
    resources,
    'taptime_da5_v5_validation_network_security',
  );
  const backupPolicyPath = resolveDa5V5ValidationPackagedXmlPath(
    resources,
    'taptime_da5_v5_validation_data_extraction_rules',
  );
  const networkPolicy = runText(
    aapt,
    [
      'dump',
      'xmltree',
      apkPath,
      networkPolicyPath,
    ],
  );
  const backupPolicy = runText(
    aapt,
    [
      'dump',
      'xmltree',
      apkPath,
      backupPolicyPath,
    ],
  );
  const signature = runText(
    apksigner,
    ['verify', '--verbose', '--print-certs', apkPath],
  );
  const entries = runText('unzip', ['-Z1', apkPath])
    .split(/\r?\n/u)
    .filter((entry) => entry.length !== 0);
  const hermesEvidence = inspectDa5V5ValidationHermesApkBundle(
    apkPath,
    entries,
  );
  const nativeEvidence = inspectDa5V5ValidationNativeBytecode(
    extractDa5V5ValidationDexBytecode(apkPath, entries),
  );
  const packageMatch =
    /^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m
      .exec(badging);
  if (packageMatch === null) {
    throw new Error('DA5 V5 Validation package metadata is unavailable');
  }
  const permissions = [...badging.matchAll(
    /^uses-permission: name='([^']+)'/gmu,
  )].map((match) => match[1]).sort();
  return Object.freeze({
    allowBackup:
      !/android:allowBackup[^\n]*\(type 0x12\)0x0/u
        .test(androidManifest),
    backupPolicyDenyAll:
      androidManifest.includes('android:dataExtractionRules')
      && resources.includes(
        ':xml/taptime_da5_v5_validation_data_extraction_rules',
      )
      && backupPolicy.includes('cloud-backup')
      && backupPolicy.includes('device-transfer')
      && [
        'database',
        'device_database',
        'device_file',
        'device_root',
        'device_sharedpref',
        'external',
        'file',
        'root',
        'sharedpref',
      ].every((domain) => backupPolicy.includes(domain)),
    cleartextTraffic:
      !/android:usesCleartextTraffic[^\n]*\(type 0x12\)0x0/u
        .test(androidManifest),
    hermesBundleCount: entries.filter(
      (entry) => entry === 'assets/index.android.bundle',
    ).length,
    networkPolicyDenyAll:
      /cleartextTrafficPermitted[^\n]*\(type 0x12\)0x0/u
        .test(networkPolicy)
      && !networkPolicy.includes('domain-config'),
    networkSecurityConfig:
      androidManifest.includes('android:networkSecurityConfig')
      && resources.includes(
        ':xml/taptime_da5_v5_validation_network_security',
      ),
    nfcFeatureRequired:
      badging.includes("uses-feature: name='android.hardware.nfc'")
      && !badging.includes(
        "uses-feature-not-required: name='android.hardware.nfc'",
      ),
    packageName: packageMatch[1],
    permissions,
    productDeepLinks:
      androidManifest.includes('android.intent.action.VIEW')
      || androidManifest.includes('android.intent.category.BROWSABLE'),
    productRuntimeMarker: hermesEvidence.productRuntimeMarker,
    productTagDispatch:
      androidManifest.includes('android.nfc.action.TECH_DISCOVERED')
      || androidManifest.includes('TapTimeNfcIngress'),
    requiredNativeModules: nativeEvidence.requiredNativeModules,
    forbiddenNativeModules: nativeEvidence.forbiddenNativeModules,
    signatureV1: signatureValue(signature, 'v1 scheme (JAR signing)'),
    signatureV2: signatureValue(
      signature,
      'v2 scheme (APK Signature Scheme v2)',
    ),
    signatureV3: signatureValue(
      signature,
      'v3 scheme (APK Signature Scheme v3)',
    ),
    signatureV31: signatureValue(
      signature,
      'v3.1 scheme (APK Signature Scheme v3.1)',
    ),
    signatureV4: signatureValue(
      signature,
      'v4 scheme (APK Signature Scheme v4)',
    ),
    signerCertificateSha256: requiredMatch(
      signature,
      /^Signer #1 certificate SHA-256 digest: ([0-9a-f]{64})$/m,
    ),
    signerCount: Number(requiredMatch(
      signature,
      /^Number of signers: ([0-9]+)$/m,
    )),
    validationRuntimeMarker: hermesEvidence.validationRuntimeMarker,
    versionCode: packageMatch[2],
    versionName: packageMatch[3],
  });
}

export function inspectDa5V5ValidationHermesBytecode(bytecodeDump) {
  if (typeof bytecodeDump !== 'string' || bytecodeDump.length === 0) {
    throw new Error('DA5 V5 Validation Hermes bytecode dump is unavailable');
  }
  return Object.freeze({
    productRuntimeMarker: [
      '127.0.0.1:3000',
      '127.0.0.1:54321',
      '@supabase/supabase-js',
      'expo-secure-store',
      'expo-sqlite',
      '/v1/offline-capture-leases',
      '/v1/lifecycle-events',
      'OfflineCaptureDatabase',
      'ProductMobile',
      'taptime-synthetic-e2e',
    ].some((value) => bytecodeDump.includes(value)),
    validationRuntimeMarker: bytecodeDump.includes(
      DA5_V5_VALIDATION_RUNTIME_MARKER,
    ),
  });
}

export function inspectDa5V5ValidationNativeBytecode(bytecode) {
  if (!Buffer.isBuffer(bytecode) || bytecode.length === 0) {
    throw new Error(
      'DA5 V5 Validation native bytecode is unavailable',
    );
  }
  return Object.freeze({
    forbiddenNativeModules: FORBIDDEN_NATIVE_BYTECODE_MARKERS.some(
      (marker) => bytecode.includes(Buffer.from(marker, 'utf8')),
    ),
    requiredNativeModules: REQUIRED_NATIVE_BYTECODE_MARKERS.every(
      (marker) => bytecode.includes(Buffer.from(marker, 'utf8')),
    ),
  });
}

function verifyManifestShape(manifest) {
  if (
    typeof manifest !== 'object'
    || manifest === null
    || Array.isArray(manifest)
    || Object.keys(manifest).sort().join('\n')
      !== [...EXACT_MANIFEST_KEYS].sort().join('\n')
  ) {
    throw new Error('DA5 V5 Validation manifest shape mismatch');
  }
  const expected = createDa5V5ValidationArtifactManifest({
    apkBytes: manifest.apkBytes,
    apkSha256: manifest.apkSha256,
    sourceCommit: manifest.sourceCommit,
    sourceClosure: manifest.sourceClosure,
    sourceTree: manifest.sourceTree,
  });
  for (const key of EXACT_MANIFEST_KEYS) {
    if (JSON.stringify(manifest[key]) !== JSON.stringify(expected[key])) {
      throw new Error('DA5 V5 Validation manifest value mismatch');
    }
  }
}

function normalizeSourceClosure(sourceClosure) {
  if (
    !Array.isArray(sourceClosure)
    || sourceClosure.length !== DA5_V5_VALIDATION_SOURCE_CLOSURE.length
  ) {
    throw new Error('DA5 V5 Validation source closure shape mismatch');
  }
  return Object.freeze(sourceClosure.map((record, index) => {
    if (
      typeof record !== 'object'
      || record === null
      || Array.isArray(record)
      || Object.keys(record).sort().join('\n') !== 'path\nsha256'
      || record.path !== DA5_V5_VALIDATION_SOURCE_CLOSURE[index]
      || typeof record.sha256 !== 'string'
      || !SHA256_PATTERN.test(record.sha256)
    ) {
      throw new Error('DA5 V5 Validation source closure value mismatch');
    }
    return Object.freeze({
      path: record.path,
      sha256: record.sha256,
    });
  }));
}

function parseManifest(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('DA5 V5 Validation manifest is invalid');
  }
}

function verifyImmutableFile(binding, dependencies, expectedIdentity) {
  if (
    typeof binding?.path !== 'string'
    || !Number.isSafeInteger(binding.bytes)
    || binding.bytes <= 0
    || !Number.isSafeInteger(binding.mode)
    || !SHA256_PATTERN.test(binding.sha256)
  ) {
    throw new Error('DA5 V5 Validation immutable binding is invalid');
  }
  const expectedPath = normalize(resolve(binding.path));
  if (expectedPath !== binding.path) {
    throw new Error('DA5 V5 Validation immutable path is not canonical');
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
    throw new Error('DA5 V5 Validation immutable metadata mismatch');
  }
  if (normalize(dependencies.realpath(expectedPath)) !== expectedPath) {
    throw new Error('DA5 V5 Validation immutable realpath mismatch');
  }
  if (dependencies.sha256(expectedPath) !== binding.sha256) {
    throw new Error('DA5 V5 Validation immutable digest mismatch');
  }
  const identity = Object.freeze({ dev: stat.dev, ino: stat.ino });
  if (
    expectedIdentity !== undefined
    && (
      identity.dev !== expectedIdentity.dev
      || identity.ino !== expectedIdentity.ino
    )
  ) {
    throw new Error('DA5 V5 Validation immutable identity mismatch');
  }
  return Object.freeze({ identity, status: 'match' });
}

function systemDependencies() {
  return Object.freeze({
    files: Object.freeze({
      lstat: lstatSync,
      readUtf8(path) {
        return readFileSync(path, 'utf8');
      },
      realpath: realpathSync,
      sha256(path) {
        return createHash('sha256')
          .update(readFileSync(path))
          .digest('hex');
      },
    }),
    inspectApk: inspectDa5V5ValidationApk,
  });
}

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`DA5 V5 Validation ${label} is invalid`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`DA5 V5 Validation ${label} is invalid`);
  }
}

function requireGitObject(value, label) {
  if (typeof value !== 'string' || !GIT_OBJECT_PATTERN.test(value)) {
    throw new Error(`DA5 V5 Validation ${label} is invalid`);
  }
}

function modeText(mode) {
  return mode.toString(8).padStart(4, '0');
}

function signatureValue(output, label) {
  return requiredMatch(
    output,
    new RegExp(
      `^Verified using ${escapeRegExp(label)}: (true|false)$`,
      'm',
    ),
  ) === 'true';
}

function requiredMatch(value, pattern) {
  const result = pattern.exec(value)?.[1];
  if (result === undefined) {
    throw new Error('DA5 V5 Validation inspection output is incomplete');
  }
  return result;
}

function inspectDa5V5ValidationHermesApkBundle(apkPath, entries) {
  const bundleEntry = 'assets/index.android.bundle';
  if (entries.filter((entry) => entry === bundleEntry).length !== 1) {
    throw new Error(
      'DA5 V5 Validation APK must contain exactly one Hermes bundle',
    );
  }
  const temporaryDirectory = mkdtempSync(join(
    tmpdir(),
    'taptime-da5-v5-validation-hermes-',
  ));
  const bundlePath = join(temporaryDirectory, 'index.android.bundle');
  try {
    writeFileSync(
      bundlePath,
      runBinary('unzip', ['-p', apkPath, bundleEntry]),
    );
    return inspectDa5V5ValidationHermesBytecode(runText(
      resolveHermesCompiler(),
      ['-b', '-dump-bytecode', '-pretty', bundlePath],
    ));
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function extractDa5V5ValidationDexBytecode(apkPath, entries) {
  const dexEntries = entries.filter(
    (entry) => /^classes(?:[0-9]+)?\.dex$/u.test(entry),
  );
  if (dexEntries.length === 0) {
    throw new Error(
      'DA5 V5 Validation APK native bytecode is unavailable',
    );
  }
  return Buffer.concat(dexEntries.map(
    (entry) => runBinary('unzip', ['-p', apkPath, entry]),
  ));
}

function resolveHermesCompiler() {
  const require = createRequire(import.meta.url);
  const packageDirectory = dirname(
    require.resolve('hermes-compiler/package.json'),
  );
  const executableDirectory = process.platform === 'darwin'
    ? 'osx-bin'
    : process.platform === 'linux'
      ? 'linux64-bin'
      : process.platform === 'win32'
        ? 'win64-bin'
        : null;
  if (executableDirectory === null) {
    throw new Error(
      'DA5 V5 Validation Hermes inspection does not support this host',
    );
  }
  const executable = join(
    packageDirectory,
    'hermesc',
    executableDirectory,
    process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
  );
  if (!existsSync(executable)) {
    throw new Error(
      'DA5 V5 Validation Hermes compiler is unavailable',
    );
  }
  return executable;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function runText(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || result.error !== undefined) {
    throw new Error('DA5 V5 Validation inspection command failed');
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
    throw new Error('DA5 V5 Validation inspection command failed');
  }
  return result.stdout;
}
