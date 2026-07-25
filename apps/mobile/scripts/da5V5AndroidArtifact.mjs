import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, normalize, resolve } from 'node:path';

import {
  verifySyntheticE2eAndroidRuntime,
} from './verifySyntheticE2eAndroidRuntime.mjs';

export const DA5_V5_ANDROID_PROFILE = 'da5-v5';
export const DA5_V5_ANDROID_PACKAGE = 'com.tim180201.mobile.synthetic';
const verifiedArtifacts = new WeakMap();

export const DA5_V5_ANDROID_ARTIFACT = Object.freeze({
  apk: Object.freeze({
    bytes: 95_522_787,
    mode: 0o444,
    path: '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/app-release-385c0c46f22dcac5.apk',
    sha256: '385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547',
  }),
  manifest: Object.freeze({
    bytes: 1_647,
    mode: 0o444,
    path: '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/artifact-manifest.txt',
    sha256: '1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb',
  }),
  packageName: DA5_V5_ANDROID_PACKAGE,
  signerCertificateSha256:
    'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
  versionCode: '1',
  versionName: '1.0.0',
});

export function requireDa5V5AndroidProfile(value) {
  if (value !== DA5_V5_ANDROID_PROFILE) {
    throw new Error('DA5 V5 Android helper requires the exact explicit profile');
  }
  return value;
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
  const initialApk = verifyDa5V5ImmutableFile(
    DA5_V5_ANDROID_ARTIFACT.apk,
    dependencies.files,
  );
  const initialManifest = verifyDa5V5ImmutableFile(
    DA5_V5_ANDROID_ARTIFACT.manifest,
    dependencies.files,
  );
  const inspection = dependencies.inspectApk(DA5_V5_ANDROID_ARTIFACT.apk.path);
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
    || inspection.nfcTechDiscovered !== true
    || inspection.nfcA !== true
    || inspection.mifareUltralight !== true
    || inspection.hermesBundleCount !== 1
  ) {
    throw new Error('DA5 V5 APK inspection mismatch');
  }
  dependencies.verifyRuntime(DA5_V5_ANDROID_ARTIFACT.apk.path);
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
  const result = Object.freeze({
    packageName: DA5_V5_ANDROID_ARTIFACT.packageName,
    status: 'match',
    versionCode: DA5_V5_ANDROID_ARTIFACT.versionCode,
    versionName: DA5_V5_ANDROID_ARTIFACT.versionName,
  });
  verifiedArtifacts.set(result, Object.freeze({
    apk: inspectedApk,
    dependencies: dependencies.files,
    manifest: inspectedManifest,
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
  const apk = verifyDa5V5ImmutableFile(DA5_V5_ANDROID_ARTIFACT.apk, files);
  const manifest = verifyDa5V5ImmutableFile(DA5_V5_ANDROID_ARTIFACT.manifest, files);
  requireSameIdentity(sealed.apk, apk);
  requireSameIdentity(sealed.manifest, manifest);
  return Object.freeze({ status: 'match' });
}

function requireSameIdentity(expected, actual) {
  if (
    expected.identity.dev !== actual.identity.dev
    || expected.identity.ino !== actual.identity.ino
  ) {
    throw new Error('DA5 V5 immutable file identity mismatch');
  }
}

function systemFileDependencies() {
  return Object.freeze({
    lstat: lstatSync,
    realpath: realpathSync,
    sha256(path) {
      return createHash('sha256').update(readFileSync(path)).digest('hex');
    },
  });
}

function systemArtifactDependencies() {
  const androidHome = process.env.ANDROID_HOME;
  if (androidHome === undefined || androidHome.length === 0) {
    throw new Error('DA5 V5 Android SDK path is unavailable');
  }
  const aapt = join(androidHome, 'build-tools', '35.0.0', 'aapt');
  const apksigner = join(androidHome, 'build-tools', '35.0.0', 'apksigner');
  return Object.freeze({
    files: systemFileDependencies(),
    inspectApk(apkPath) {
      const badging = runText(aapt, ['dump', 'badging', apkPath]);
      const manifest = runText(aapt, ['dump', 'xmltree', apkPath, 'AndroidManifest.xml']);
      const resources = runText(aapt, ['dump', 'resources', apkPath]);
      const signature = runText(apksigner, ['verify', '--verbose', '--print-certs', apkPath]);
      const entries = runText('unzip', ['-Z1', apkPath])
        .split(/\r?\n/u)
        .filter((entry) => entry.length !== 0);
      const compiledXmlStrings = asciiStrings(
        runBinary('unzip', ['-p', apkPath, 'res/*.xml']),
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
        mifareUltralight: compiledXmlStrings.includes(
          'android.nfc.tech.MifareUltralight',
        ),
        networkSecurityConfig: (
          manifest.includes('android:networkSecurityConfig')
          && resources.includes(':xml/taptime_synthetic_e2e_network_security_config')
          && compiledXmlStrings.includes('127.0.0.1')
          && compiledXmlStrings.includes('cleartextTrafficPermitted')
        ),
        nfcA: compiledXmlStrings.includes('android.nfc.tech.NfcA'),
        nfcTechDiscovered: (
          manifest.includes('android.nfc.action.TECH_DISCOVERED')
          && resources.includes(':xml/taptime_nfc_tech_filter')
        ),
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
    verifyRuntime: verifySyntheticE2eAndroidRuntime,
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
