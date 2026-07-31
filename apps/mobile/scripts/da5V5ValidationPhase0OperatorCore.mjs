import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fileConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { performance } from 'node:perf_hooks';
import { join, normalize, resolve } from 'node:path';

import {
  Da5V5AndroidCommandAbortError,
  Da5V5AndroidCommandTimeoutError,
  Da5V5UsbSerialBinding,
  SystemDa5V5AndroidAdbRunner,
  isDa5V5AndroidCommandAbortError,
  isDa5V5AndroidCommandTimeoutError,
  requireSingleDa5V5UsbDevice,
} from './da5V5AndroidDevice.mjs';
import {
  DA5_V5_VALIDATION_PACKAGE,
  DA5_V5_VALIDATION_UNZIP_PATH,
  requireDa5V5ValidationAndroidSdkAuthority,
  verifyDa5V5ValidationArtifactBinding,
} from './da5V5ValidationArtifact.mjs';
import {
  DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES,
  DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES,
  SystemDa5V5ValidationInstallStreamRunner,
} from './da5V5ValidationInstallStream.mjs';
import {
  assertDa5V5ValidationToolIdentityMetadata,
  verifyDa5V5ValidationToolIdentity,
} from './da5V5ValidationRuntimeContract.mjs';

export const DA5_V5_VALIDATION_PHASE0_PROFILE =
  'da5-v5-validation-phase0';
export const DA5_V5_VALIDATION_PHASE0_ACTIVITY =
  `${DA5_V5_VALIDATION_PACKAGE}/.MainActivity`;
export const DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES =
  Object.freeze({
    installation: 'installation',
    installedProvenance: 'installed_provenance',
    prelaunch: 'prelaunch',
    activityStart: 'activity_start',
    postlaunch: 'postlaunch',
  });
export const DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES =
  Object.freeze({
    adbChildExitMismatch:
      DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
        .childExitMismatch,
    adbChildTimeoutMismatch:
      DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
        .childTimeoutMismatch,
    adbChildTransportMismatch:
      DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
        .childTransportMismatch,
    adbStdinPipeAbortMismatch:
      DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
        .stdinPipeAbortMismatch,
    operatorAbortMismatch: 'operator_abort_mismatch',
    operationMismatch: 'operation_mismatch',
    packageManagerArtifactRejection:
      'package_manager_artifact_rejection',
    packageManagerCommandContractMismatch:
      'package_manager_command_contract_mismatch',
    packageManagerInstalledStateConflict:
      'package_manager_installed_state_conflict',
    packageManagerPolicyRestriction:
      'package_manager_policy_restriction',
    packageManagerReceiptMismatch: 'package_manager_receipt_mismatch',
    packageManagerStorageRejection:
      'package_manager_storage_rejection',
    verificationMismatch: 'verification_mismatch',
  });
const packageManagerArtifactRejections = Object.freeze([
  'INSTALL_FAILED_BAD_DEX_METADATA',
  'INSTALL_FAILED_BAD_SIGNATURE',
  'INSTALL_FAILED_CPU_ABI_INCOMPATIBLE',
  'INSTALL_FAILED_DEXOPT',
  'INSTALL_FAILED_INVALID_APK',
  'INSTALL_FAILED_INVALID_URI',
  'INSTALL_FAILED_MISSING_FEATURE',
  'INSTALL_FAILED_MISSING_SHARED_LIBRARY',
  'INSTALL_FAILED_MISSING_SPLIT',
  'INSTALL_FAILED_NEWER_SDK',
  'INSTALL_FAILED_NO_MATCHING_ABIS',
  'INSTALL_FAILED_OLDER_SDK',
  'INSTALL_FAILED_PACKAGE_CHANGED',
  'INSTALL_FAILED_PROCESS_NOT_DEFINED',
  'INSTALL_FAILED_TEST_ONLY',
  'INSTALL_FAILED_VERIFICATION_FAILURE',
  'INSTALL_FAILED_VERIFICATION_TIMEOUT',
  'INSTALL_PARSE_FAILED_BAD_MANIFEST',
  'INSTALL_PARSE_FAILED_BAD_PACKAGE_NAME',
  'INSTALL_PARSE_FAILED_BAD_SHARED_USER_ID',
  'INSTALL_PARSE_FAILED_CERTIFICATE_ENCODING',
  'INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES',
  'INSTALL_PARSE_FAILED_MANIFEST_EMPTY',
  'INSTALL_PARSE_FAILED_MANIFEST_MALFORMED',
  'INSTALL_PARSE_FAILED_NO_CERTIFICATES',
  'INSTALL_PARSE_FAILED_NOT_APK',
  'INSTALL_PARSE_FAILED_ONLY_COREAPP_ALLOWED',
  'INSTALL_PARSE_FAILED_RESOURCES_ARSC_COMPRESSED',
  'INSTALL_PARSE_FAILED_SKIPPED',
  'INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION',
]);
const packageManagerInstalledStateConflicts = Object.freeze([
  'INSTALL_FAILED_ALREADY_EXISTS',
  'INSTALL_FAILED_BAD_PERMISSION_GROUP',
  'INSTALL_FAILED_CONFLICTING_PROVIDER',
  'INSTALL_FAILED_DUPLICATE_PACKAGE',
  'INSTALL_FAILED_DUPLICATE_PERMISSION',
  'INSTALL_FAILED_DUPLICATE_PERMISSION_GROUP',
  'INSTALL_FAILED_NO_SHARED_USER',
  'INSTALL_FAILED_PERMISSION_MODEL_DOWNGRADE',
  'INSTALL_FAILED_REPLACE_COULDNT_DELETE',
  'INSTALL_FAILED_SANDBOX_VERSION_DOWNGRADE',
  'INSTALL_FAILED_SHARED_USER_INCOMPATIBLE',
  'INSTALL_FAILED_UID_CHANGED',
  'INSTALL_FAILED_UPDATE_INCOMPATIBLE',
  'INSTALL_FAILED_VERSION_DOWNGRADE',
  'INSTALL_FAILED_WRONG_INSTALLED_VERSION',
]);
const packageManagerStorageRejections = Object.freeze([
  'INSTALL_FAILED_CONTAINER_ERROR',
  'INSTALL_FAILED_INSUFFICIENT_STORAGE',
  'INSTALL_FAILED_INVALID_INSTALL_LOCATION',
  'INSTALL_FAILED_MEDIA_UNAVAILABLE',
]);
const packageManagerFailureReceiptPattern =
  /^Failure \[(INSTALL_(?:FAILED|PARSE_FAILED)_[A-Z0-9_]+)(?:: [^\u0000-\u001f\u007f\]]{1,1536})?\]$/u;
export const DA5_V5_VALIDATION_PHASE0_ARTIFACT = Object.freeze({
  apk: Object.freeze({
    bytes: 65_634_553,
    mode: 0o444,
    path:
      '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716/app-release-3d5450f257eda716.apk',
    sha256:
      '3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144',
  }),
  manifest: Object.freeze({
    bytes: 6_855,
    mode: 0o444,
    path:
      '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716/manifest-5675297dab94.json',
    sha256:
      '1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a',
  }),
  sourceClosureJsonSha256:
    '62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763',
  sourceClosureRecords: 33,
  sourceCommit: '5675297dab94258e50d7371a95e07fe7a77fc51c',
  sourceTree: 'b32af38c8ac769965ab062762004312d96d0de25',
});
const exactSourceClosure = Object.freeze([
  Object.freeze({
    path: 'apps/mobile/app.config.js',
    sha256: '1ca63463e07b0c7c7111a653f1549bdad1011219300db771e740537d9908811b',
  }),
  Object.freeze({
    path: 'apps/mobile/app.json',
    sha256: '692f6c6c3fb7214bc797af152cbc5572e393d5cdab6a0fd1062e47a0f0fa7250',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/android-icon-background.png',
    sha256: 'fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/android-icon-foreground.png',
    sha256: '9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/android-icon-monochrome.png',
    sha256: '6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/icon.png',
    sha256: '119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/build.gradle',
    sha256: 'd7b10372584f1ba7b9b999c0a515bfeae64e0ed0f615e98a910478d40e478517',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/src/main/AndroidManifest.xml',
    sha256: 'e20c6e02b4518b90a049a5ce81d99274978b87e2b02433dcb626daf545c9669e',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/src/main/java/com/taptime/da5validationbinding/Da5V5ValidationDeviceBindingModule.kt',
    sha256: 'ced432bef3c8970f745db5d495a024a4f6e9af9d2a7ca8dc0f7046ed4ccd73d5',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/expo-module.config.json',
    sha256: '7c762172127c09833c755aaa8e87ba70b492fb0bbf21cb073f873fb12208dd62',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/index.ts',
    sha256: '88bcdc21a78a619d939b3923f5b37247e7a601830ca255f70465b6569ecb11a8',
  }),
  Object.freeze({
    path: 'apps/mobile/package.json',
    sha256: '1afe19fc3898543dd91afa23e9f9658959c1c569ee569d2b9e0e83005cbd0165',
  }),
  Object.freeze({
    path: 'apps/mobile/plugins/withDa5V5ValidationAndroidBoundary.js',
    sha256: '40089612eb27084888b7a226099625991df4a109784123e301265778adc9264a',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/buildDa5V5ValidationAndroid.mjs',
    sha256: 'd8034c199a002e0418bccb41266dc5640c5bb8beedc6d8363c3ec3c3c35242f9',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationArtifact.mjs',
    sha256: '7d1c5c7e316a09f7222f76c35b1b67eed414150cfe57dd8ddcbcbd4bf0a317e2',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationBuildProcess.mjs',
    sha256: 'a33d935d287fc498b3b38b6be193a350a5069f1ff4312e554a0018953bdd48f4',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationNativeSourceBinding.mjs',
    sha256: 'afbf1c3fc8983f5c83f00ed4c66b8ea311a677e3060e43419860fe2d933a85ab',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs',
    sha256: '8bf8198b3d13a55490d9276c2d74ae73c52a63783785aece848e2116841baeb2',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs',
    sha256: '58bd20ece4bb670e64af3f411fbc50b585af753522e2dc291a822b68467754f2',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationSourceBinding.mjs',
    sha256: '066d359f5038ddd45c4d6113792002b49f2e0783b830cb6cb8b78b3faa80c310',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/publishDa5V5ValidationArtifact.mjs',
    sha256: '051e328083deb8a8bea4b5ba1119378f8dd2209cafa92886e2f36a02a33f7536',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/verifyDa5V5ValidationAndroidArtifact.mjs',
    sha256: 'c1c0f38e7a44caa9c3ddae10cbddefce7c271b1818a61ff4904f30dda59aaee2',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationContract.ts',
    sha256: 'dfd977e00f06c11ed5a1f749a353f90fa107af9598ee419ce163dc8ae9149c8c',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationController.ts',
    sha256: '037f1926bd37b240285d81a398317dc413ca6a223f37e7a1ee4b402ff4fd45ac',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationDeviceBinding.ts',
    sha256: '966de7e51e8df66021f5a1ec5e653dd1c40ee6d9c776c3c79e226065572eb3ee',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationMobileApp.tsx',
    sha256: '52993984c9921975a252ed5ab858c0dd7f3f34cdaaf7b8121c2bc4b8ca04730d',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationNfcCapture.ts',
    sha256: '2c42b2d4df227767e1f7e650025e25de2e83b39d8746c36dc14f4d8c5697e53f',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/NativeDa5V5ValidationDeviceBinding.ts',
    sha256: '924dae53aea020d333b5db65753361401737c79d0086bd20badb2da25f345bc9',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/createDa5V5ValidationRuntime.ts',
    sha256: '9ddd9730992e565f53f4e50296d1331c348fb1a9f731d93e5cfa291d0edd6759',
  }),
  Object.freeze({
    path: 'apps/mobile/tsconfig.json',
    sha256: '712583ff9cdb4b4e4f9b000a4a56d68db8dc1921cbfbc36d490a3a9f2be3dd72',
  }),
  Object.freeze({
    path: 'apps/mobile/validation-index.ts',
    sha256: 'd42c0ff8424077c43df5396969cc08d547e857b1e2ebff0081b17543374e49e8',
  }),
  Object.freeze({
    path: 'package-lock.json',
    sha256: '62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470',
  }),
  Object.freeze({
    path: 'package.json',
    sha256: '34b577bee93440e296b2d61d8b47265224324a3e75e9f3053aaa7d337ebcd57a',
  }),
]);

const timeouts = Object.freeze({
  inspect: 15_000,
  install: 240_000,
  launch: 30_000,
  uninstall: 120_000,
});
const cleanupPolicy = Object.freeze({
  knownMaximumMilliseconds: 30_000,
  nullWindowMilliseconds: 15_000,
  pollMilliseconds: 250,
  uncertainMaximumMilliseconds:
    timeouts.install + 15_000 + timeouts.inspect,
});
const androidOwnerUser = '0';
const maximumPackageInstallerSessionId = 2_147_483_647;
const validationInstallSplitName = 'base.apk';
const validationVersionCode = '1';
const safeSegmentPattern = /^[A-Za-z0-9._~+=-]{1,192}$/u;
const packageDirectoryPrefix = `${DA5_V5_VALIDATION_PACKAGE}-`;

export function requireDa5V5ValidationPhase0Inputs(value) {
  const androidSdkAuthority =
    requireDa5V5ValidationAndroidSdkAuthority(
      value?.androidSdkAuthority,
    );
  const tools = requireDa5V5ValidationPhase0Tools(
    value?.tools,
    androidSdkAuthority,
  );
  if (
    value?.profile !== DA5_V5_VALIDATION_PHASE0_PROFILE
    || !isBoundInput(value.deviceModel)
    || !isBoundInput(value.androidBuild)
  ) {
    throw new Error('DA5 V5 Validation Phase-0 authority input mismatch');
  }
  return Object.freeze({
    androidBuild: value.androidBuild,
    androidSdkAuthority,
    deviceModel: value.deviceModel,
    profile: DA5_V5_VALIDATION_PHASE0_PROFILE,
    tools,
  });
}

function requireDa5V5ValidationPhase0Tools(value, authority) {
  const tools = Object.freeze({
    aapt: requireToolIdentity(value?.aapt),
    adb: requireToolIdentity(value?.adb),
    apksigner: requireToolIdentity(value?.apksigner),
    hermesc: requireToolIdentity(value?.hermesc),
    unzip: requireToolIdentity(value?.unzip),
  });
  if (
    tools.adb.path
      !== join(authority.path, 'platform-tools', 'adb')
    || tools.aapt.path
      !== join(authority.path, 'build-tools', '35.0.0', 'aapt')
    || tools.apksigner.path
      !== join(
        authority.path,
        'build-tools',
        '35.0.0',
        'apksigner',
      )
    || tools.unzip.path !== DA5_V5_VALIDATION_UNZIP_PATH
  ) {
    throw new Error(
      'DA5 V5 Validation Phase-0 tool authority mismatch',
    );
  }
  return tools;
}

function requireToolIdentity(value) {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || !Number.isSafeInteger(value.bytes)
    || value.bytes <= 0
    || typeof value.dev !== 'string'
    || !/^(?:0|[1-9][0-9]*)$/u.test(value.dev)
    || typeof value.ino !== 'string'
    || !/^(?:0|[1-9][0-9]*)$/u.test(value.ino)
    || !Number.isSafeInteger(value.mode)
    || value.mode < 0
    || value.mode > 0o7777
    || typeof value.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(value.sha256)
    || typeof value.path !== 'string'
    || value.path.length === 0
    || normalize(resolve(value.path)) !== value.path
  ) {
    throw new Error(
      'DA5 V5 Validation Phase-0 tool authority mismatch',
    );
  }
  return value;
}

export function parseDa5V5ValidationInstalledBaseApkPath(value) {
  const line = exactSingleLine(value);
  if (!line.startsWith('package:')) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  const path = line.slice('package:'.length);
  if (!path.startsWith('/data/app/') || !path.endsWith('/base.apk')) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  const segments = path.slice('/data/app/'.length).split('/');
  if (segments.length !== 2 && segments.length !== 3) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  if (segments.at(-1) !== 'base.apk') {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  const packageDirectory = segments.at(-2);
  const parent = segments.length === 3 ? segments[0] : undefined;
  if (
    packageDirectory === undefined
    || !packageDirectory.startsWith(packageDirectoryPrefix)
    || !isSafePathSegment(
      packageDirectory.slice(packageDirectoryPrefix.length),
    )
    || (
      parent !== undefined
      && (
        !parent.startsWith('~~')
        || !isSafePathSegment(parent)
        || parent.length === 2
      )
    )
  ) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  return path;
}

export function parseDa5V5ValidationInstalledStat(value) {
  const match = /^([0-9]+):([0-9]+):([0-9]+):([0-9a-fA-F]+)$/u
    .exec(exactSingleLine(value));
  if (match === null) {
    throw new Error('DA5 V5 Validation installed package stat mismatch');
  }
  const [, device, inode, sizeText, modeText] = match;
  const size = Number(sizeText);
  const mode = BigInt(`0x${modeText}`);
  if (
    device === undefined
    || inode === undefined
    || !Number.isSafeInteger(size)
    || size < 0
    || (mode & 0o170000n) !== 0o100000n
    || (mode & 0o022n) !== 0n
  ) {
    throw new Error('DA5 V5 Validation installed package stat mismatch');
  }
  return Object.freeze({
    device,
    inode,
    mode: mode.toString(16),
    size,
  });
}

export function parseDa5V5ValidationAndroidUserTopology(value) {
  const lines = exactLines(value);
  if (lines.shift() !== 'Users:' || lines.length !== 1) {
    throw new Error('DA5 V5 Validation Android user topology mismatch');
  }
  const match =
    /^UserInfo\{([0-9]+):[^{}\0\r\n]*:[0-9a-fA-F]+\} running$/u
      .exec(lines[0]?.trim() ?? '');
  if (match?.[1] !== androidOwnerUser) {
    throw new Error('DA5 V5 Validation Android user topology mismatch');
  }
  return Object.freeze({
    currentUser: androidOwnerUser,
    mainUser: androidOwnerUser,
    ownerUser: androidOwnerUser,
  });
}

export function sealDa5V5ValidationInstallSnapshot(
  binding,
  files = systemStableFileDependencies(),
) {
  requireHostBinding(binding);
  const fileDescriptor = files.openReadOnly(binding.path);
  let snapshot;
  try {
    const before = requireStableHostFile(
      binding,
      fileDescriptor,
      files,
    );
    snapshot = files.readFileDescriptor(fileDescriptor, binding.bytes);
    if (
      !Buffer.isBuffer(snapshot)
      || snapshot.length !== binding.bytes
      || createHash('sha256').update(snapshot).digest('hex') !== binding.sha256
    ) {
      throw new Error('DA5 V5 Validation stable snapshot digest mismatch');
    }
    const after = requireStableHostFile(
      binding,
      fileDescriptor,
      files,
    );
    if (before.dev !== after.dev || before.ino !== after.ino) {
      throw new Error('DA5 V5 Validation stable snapshot identity mismatch');
    }
  } catch (error) {
    snapshot?.fill(0);
    try {
      files.close(fileDescriptor);
    } catch {
      throw new Error('DA5 V5 Validation stable snapshot close mismatch');
    }
    throw error;
  }
  try {
    files.close(fileDescriptor);
  } catch {
    snapshot.fill(0);
    throw new Error('DA5 V5 Validation stable snapshot close mismatch');
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
    state() {
      return destroyed ? 'destroyed' : used ? 'used' : 'ready';
    },
    status: 'match',
    async use(operation) {
      if (destroyed || used || typeof operation !== 'function') {
        throw new Error('DA5 V5 Validation install snapshot unavailable');
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

export function verifyAndSealDa5V5ValidationPhase0Artifact(options = {}) {
  if (options.profile !== DA5_V5_VALIDATION_PHASE0_PROFILE) {
    throw new Error('DA5 V5 Validation Phase-0 profile mismatch');
  }
  if (
    exactSourceClosure.length
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceClosureRecords
    || createHash('sha256')
      .update(JSON.stringify(exactSourceClosure))
      .digest('hex')
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceClosureJsonSha256
  ) {
    throw new Error('DA5 V5 Validation source closure binding mismatch');
  }
  const verifyArtifact =
    options.verifyArtifact ?? verifyDa5V5ValidationArtifactBinding;
  const androidSdkAuthority =
    requireDa5V5ValidationAndroidSdkAuthority(
      options.androidSdkAuthority,
    );
  const inspectionTools =
    requireDa5V5ValidationPhase0Tools(
      options.inspectionTools,
      androidSdkAuthority,
    );
  const verificationOptions = {
    androidSdkAuthority,
    apk: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk,
    expectedSourceClosure: exactSourceClosure,
    expectedSourceCommit:
      DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit,
    expectedSourceTree: DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree,
    inspectionTools,
    manifest: DA5_V5_VALIDATION_PHASE0_ARTIFACT.manifest,
    toolIdentityDependencies: options.toolIdentityDependencies,
  };
  const verified = options.artifactVerificationDependencies === undefined
    ? verifyArtifact(verificationOptions)
    : verifyArtifact(
      verificationOptions,
      options.artifactVerificationDependencies,
    );
  if (
    verified?.status !== 'match'
    || verified.packageName !== DA5_V5_VALIDATION_PACKAGE
    || verified.sourceCommit
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit
    || verified.sourceTree
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree
  ) {
    throw new Error('DA5 V5 Validation artifact verification mismatch');
  }
  return sealDa5V5ValidationInstallSnapshot(
    DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk,
    options.stableFiles,
  );
}

export async function verifyDa5V5ValidationInstalledArtifact(options) {
  if (typeof options.runner?.runBinaryDigest !== 'function') {
    throw new Error('DA5 V5 Validation installed digest unavailable');
  }
  if (
    options.deadline !== undefined
    && (!isDeadline(options.deadline) || typeof options.now !== 'function')
  ) {
    throw new Error('DA5 V5 Validation installed deadline unavailable');
  }
  const budget = options.deadline === undefined
    ? undefined
    : { deadline: options.deadline, now: options.now };
  await requireOwnerUserTopology(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  await requireOwnerPackagePresent(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  await requireOwnerInstalledVersion(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  const beforePath = await readInstalledPackagePath(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  const beforeCanonical = await readInstalledCanonical(
    options.runner,
    options.serial,
    beforePath,
    options.signal,
    budget,
  );
  const beforeStat = await readInstalledStat(
    options.runner,
    options.serial,
    beforePath,
    options.signal,
    budget,
  );
  if (
    beforeCanonical !== beforePath
    || beforeStat.size !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes
  ) {
    throw new Error('DA5 V5 Validation installed artifact mismatch');
  }
  const digest = await options.runner.runBinaryDigest(
    ['-s', options.serial, 'shell', '-T', 'cat', '--', beforePath],
    {
      maximumBytes: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes,
      signal: options.signal,
      timeoutMilliseconds: budget === undefined
        ? timeouts.install
        : remainingTimeout(
          budget.deadline,
          budget.now,
          timeouts.install,
        ),
    },
  );
  if (
    digest.bytes !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes
    || digest.sha256 !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256
  ) {
    throw new Error('DA5 V5 Validation installed artifact digest mismatch');
  }
  await requireOwnerUserTopology(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  await requireOwnerPackagePresent(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  await requireOwnerInstalledVersion(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  const afterPath = await readInstalledPackagePath(
    options.runner,
    options.serial,
    options.signal,
    budget,
  );
  const afterCanonical = await readInstalledCanonical(
    options.runner,
    options.serial,
    afterPath,
    options.signal,
    budget,
  );
  const afterStat = await readInstalledStat(
    options.runner,
    options.serial,
    afterPath,
    options.signal,
    budget,
  );
  if (
    afterPath !== beforePath
    || afterCanonical !== beforeCanonical
    || JSON.stringify(afterStat) !== JSON.stringify(beforeStat)
  ) {
    throw new Error('DA5 V5 Validation installed artifact changed');
  }
  return Object.freeze({
    canonicalPath: afterCanonical,
    path: afterPath,
    sha256: digest.sha256,
    stat: afterStat,
    status: 'match',
    versionCode: validationVersionCode,
  });
}

export class Da5V5ValidationPhase0Device {
  #abandonFlight;
  #cleanupFlight;
  #cleanupDeadline;
  #installSessionId;
  #installSessionState = 'none';
  #installUncertain = false;
  #mutationMayHaveStarted = false;
  #ownedProvenance;
  #preflightMatched = false;
  #preflightStarted = false;

  constructor(options) {
    this.installStreamRunner = options.installStreamRunner;
    this.runner = options.runner;
    this.serialBinding = options.serialBinding;
    this.deviceBinding = Object.freeze({
      androidBuild: options.androidBuild,
      deviceModel: options.deviceModel,
    });
    this.snapshot = options.snapshot;
    this.now = options.now ?? (() => performance.now());
    this.wait = options.wait ?? wait;
  }

  async preflight(options = {}) {
    this.#preflightStarted = true;
    const serial = await this.#requireCurrentDevice(options.signal);
    await requirePackageProcessReverseZero(
      this.runner,
      serial,
      options.signal,
    );
    this.#preflightMatched = true;
    return Object.freeze({ status: 'match' });
  }

  async installAndLaunch(options = {}) {
    let diagnosticStage =
      DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES.installation;
    let diagnosticCategory =
      DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.verificationMismatch;
    try {
      if (!this.#preflightMatched || this.#mutationMayHaveStarted) {
        throw new Error('DA5 V5 Validation install order mismatch');
      }
      const serial = await this.#requireCurrentDevice(options.signal);
      await requirePackageProcessReverseZero(
        this.runner,
        serial,
        options.signal,
      );
      const installSerial =
        await this.#requireCurrentDevice(options.signal);
      if (
        installSerial !== serial
        || await readOwnerPackageRegistration(
          this.runner,
          installSerial,
          { signal: options.signal },
        ) !== 'absent'
      ) {
        throw new Error('DA5 V5 Validation package preinstall changed');
      }
      this.#installUncertain = true;
      this.#mutationMayHaveStarted = true;
      this.#installSessionState = 'uncertain';
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
          .adbChildTransportMismatch;
      const installDeadline = this.now() + timeouts.install;
      const createReceipt = parsePackageManagerCreateReceipt(
        await this.runner.run(
          [
            '-s',
            installSerial,
            'shell',
            '-T',
            '-x',
            'cmd',
            'package',
            'install-create',
            '-R',
            '--user',
            androidOwnerUser,
            '--pkg',
            DA5_V5_VALIDATION_PACKAGE,
            '-S',
            String(DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes),
          ],
          {
            signal: options.signal,
            timeoutMilliseconds: remainingInstallTimeout(
              installDeadline,
              this.now,
              timeouts.install,
            ),
          },
        ),
      );
      if (createReceipt.status !== 'match') {
        diagnosticCategory = createReceipt.category;
        if (createReceipt.sessionAbsent) {
          this.#installSessionState = 'absent';
          this.#installUncertain = false;
        }
        throw new Error('DA5 V5 Validation session create mismatch');
      }
      this.#installSessionId = createReceipt.sessionId;
      this.#installSessionState = 'pending';

      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.verificationMismatch;
      const writeSerial =
        await this.#requireCurrentDevice(options.signal);
      if (writeSerial !== installSerial) {
        throw new Error('DA5 V5 Validation write device mismatch');
      }
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
          .adbChildTransportMismatch;
      const installOutcome = await this.snapshot.use((snapshot) =>
        this.installStreamRunner.write(
          [
            '-s',
            writeSerial,
            'shell',
            '-T',
            '-x',
            'cmd',
            'package',
            'install-write',
            '-S',
            String(DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes),
            this.#installSessionId,
            validationInstallSplitName,
            '-',
          ],
          {
            signal: options.signal,
            stdinBytes: snapshot,
            timeoutMilliseconds: remainingInstallTimeout(
              installDeadline,
              this.now,
              timeouts.install,
            ),
          },
        ));
      if (
        installOutcome?.status === 'mismatch'
        && Object.values(
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES,
        ).includes(installOutcome.category)
      ) {
        diagnosticCategory = installOutcome.category;
        if (
          installOutcome.terminalCause
          === DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES.signalAbort
        ) {
          throw new Da5V5AndroidCommandAbortError();
        }
        throw new Error('DA5 V5 Validation install stream mismatch');
      }
      if (
        installOutcome?.status !== 'match'
        || (
          installOutcome.stdinTerminal !== 'finished'
          && installOutcome.stdinTerminal
            !== 'all_bytes_submitted_then_pipe_closed'
          && installOutcome.stdinTerminal
            !== 'partial_then_pipe_closed'
        )
        || typeof installOutcome.stdout !== 'string'
      ) {
        throw new Error('DA5 V5 Validation install stream mismatch');
      }
      const packageManagerCategory =
        classifyPackageManagerWriteReceipt(
          installOutcome.stdout,
          installOutcome.stdinTerminal,
          DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes,
        );
      if (packageManagerCategory !== null) {
        diagnosticCategory = packageManagerCategory;
        throw new Error('DA5 V5 Validation package write mismatch');
      }
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.verificationMismatch;
      const commitSerial =
        await this.#requireCurrentDevice(options.signal);
      if (commitSerial !== installSerial) {
        throw new Error('DA5 V5 Validation commit device mismatch');
      }
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
          .adbChildTransportMismatch;
      const commitCategory = classifyPackageManagerInstallReceipt(
        await this.runner.run(
          [
            '-s',
            commitSerial,
            'shell',
            '-T',
            '-x',
            'cmd',
            'package',
            'install-commit',
            this.#installSessionId,
          ],
          {
            signal: options.signal,
            timeoutMilliseconds: remainingInstallTimeout(
              installDeadline,
              this.now,
              timeouts.install,
            ),
          },
        ),
      );
      if (commitCategory !== null) {
        diagnosticCategory = commitCategory;
        throw new Error('DA5 V5 Validation package commit mismatch');
      }
      this.#installSessionState = 'committed';
      this.#installSessionId = undefined;

      diagnosticStage =
        DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES
          .installedProvenance;
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.verificationMismatch;
      const proofSerial =
        await this.#requireCurrentDevice(options.signal);
      if (proofSerial !== installSerial) {
        throw new Error('DA5 V5 Validation install device mismatch');
      }
      const provenance = await verifyDa5V5ValidationInstalledArtifact({
        runner: this.runner,
        serial: proofSerial,
        signal: options.signal,
      });
      this.#ownedProvenance = provenance;
      this.#installUncertain = false;

      diagnosticStage =
        DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES.prelaunch;
      await requireReverseZero(this.runner, proofSerial, options.signal);
      const processesBefore = await readMatchingProcesses(
        this.runner,
        proofSerial,
        options.signal,
      );
      if (processesBefore.length !== 0) {
        throw new Error('DA5 V5 Validation process prelaunch mismatch');
      }
      const launchSerial =
        await this.#requireCurrentDevice(options.signal);
      await requireOwnedProvenance(
        this.runner,
        launchSerial,
        this.#ownedProvenance,
        { signal: options.signal },
      );

      diagnosticStage =
        DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES.activityStart;
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.operationMismatch;
      const launch = await this.runner.run(
        [
          '-s',
          launchSerial,
          'shell',
          'am',
          'start',
          '-W',
          '--user',
          androidOwnerUser,
          '-n',
          DA5_V5_VALIDATION_PHASE0_ACTIVITY,
        ],
        {
          signal: options.signal,
          timeoutMilliseconds: timeouts.launch,
        },
      );
      requireExactLaunchReceipt(launch);

      diagnosticStage =
        DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES.postlaunch;
      diagnosticCategory =
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.verificationMismatch;
      const processesAfter = await readMatchingProcesses(
        this.runner,
        launchSerial,
        options.signal,
      );
      if (
        processesAfter.length !== 1
        || processesAfter[0] !== DA5_V5_VALIDATION_PACKAGE
      ) {
        throw new Error('DA5 V5 Validation launched process mismatch');
      }
      await requireReverseZero(
        this.runner,
        launchSerial,
        options.signal,
      );
      const postLaunchSerial =
        await this.#requireCurrentDevice(options.signal);
      await requireOwnedProvenance(
        this.runner,
        postLaunchSerial,
        this.#ownedProvenance,
        { signal: options.signal },
      );
      return Object.freeze({ status: 'match' });
    } catch (error) {
      if (
        isDa5V5AndroidCommandAbortError(error)
        && options.operatorAbortRequested?.() === true
      ) {
        diagnosticCategory =
          DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
            .operatorAbortMismatch;
      } else if (
        isDa5V5AndroidCommandTimeoutError(error)
      ) {
        diagnosticCategory =
          DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
            .adbChildTimeoutMismatch;
      }
      throw new Da5V5ValidationInstallLaunchFailure(
        diagnosticStage,
        diagnosticCategory,
      );
    }
  }

  finishMaximumMilliseconds() {
    return this.#installUncertain
      ? cleanupPolicy.uncertainMaximumMilliseconds
      : cleanupPolicy.knownMaximumMilliseconds;
  }

  cleanup(options = {}) {
    if (this.#cleanupFlight !== undefined) {
      return this.#cleanupFlight;
    }
    this.#cleanupDeadline = options.deadline
      ?? this.now() + this.finishMaximumMilliseconds();
    this.#cleanupFlight = this.#performCleanup(this.#cleanupDeadline);
    return this.#cleanupFlight;
  }

  async #performCleanup(deadline) {
    this.snapshot.destroy();
    if (!isDeadline(deadline) || this.now() >= deadline) {
      return Object.freeze({ status: 'mismatch' });
    }
    const sessionCleanup = await this.#settleInstallSession(deadline);
    const installSessionSettled = sessionCleanup.status === 'match';
    if (!this.#preflightStarted && !this.#mutationMayHaveStarted) {
      return Object.freeze({
        status: installSessionSettled ? 'match' : 'mismatch',
      });
    }
    const uncertain = this.#installUncertain;
    let consecutiveZero = 0;
    let zeroSince = null;
    while (hasDeadlineBudget(deadline, this.now)) {
      try {
        const serial = await this.#requireCurrentDevice(
          undefined,
          deadline,
        );
        const observation = await readCleanupObservation(
          this.runner,
          serial,
          { deadline, now: this.now },
        );
        requireDeadlineBudget(deadline, this.now);
        if (
          observation.packageMaybePresent
          || observation.processMaybePresent
        ) {
          if (
            !this.#mutationMayHaveStarted
            || !observation.exact
          ) {
            return Object.freeze({ status: 'mismatch' });
          }
          consecutiveZero = 0;
          zeroSince = null;
          if (
            observation.packagePresent
            && this.#ownedProvenance === undefined
          ) {
            const provenanceSerial = await this.#requireCurrentDevice(
              undefined,
              deadline,
            );
            this.#ownedProvenance =
              await verifyDa5V5ValidationInstalledArtifact({
                deadline,
                now: this.now,
                runner: this.runner,
                serial: provenanceSerial,
              });
          }
          const stopSerial = await this.#requireCurrentDevice(
            undefined,
            deadline,
          );
          if (observation.packagePresent) {
            await requireOwnedProvenance(
              this.runner,
              stopSerial,
              this.#ownedProvenance,
              { deadline, now: this.now },
            );
          }
          requireDeadlineBudget(deadline, this.now);
          await this.runner.run(
            ['-s', stopSerial, 'shell', 'am', 'force-stop',
              '--user', androidOwnerUser,
              DA5_V5_VALIDATION_PACKAGE],
            {
              timeoutMilliseconds: remainingTimeout(
                deadline,
                this.now,
                timeouts.launch,
              ),
            },
          );
          if (observation.packagePresent) {
            const uninstallSerial = await this.#requireCurrentDevice(
              undefined,
              deadline,
            );
            await requireOwnedProvenance(
              this.runner,
              uninstallSerial,
              this.#ownedProvenance,
              { deadline, now: this.now },
            );
            requireDeadlineBudget(deadline, this.now);
            const uninstall = await this.runner.run(
              ['-s', uninstallSerial, 'shell', 'cmd', 'package', 'uninstall',
                '--user', androidOwnerUser, '--versionCode',
                validationVersionCode,
                DA5_V5_VALIDATION_PACKAGE],
              {
                timeoutMilliseconds: remainingTimeout(
                  deadline,
                  this.now,
                  timeouts.uninstall,
                ),
              },
            );
            requireDeadlineBudget(deadline, this.now);
            if (exactSingleLine(uninstall) !== 'Success') {
              throw new Error('DA5 V5 Validation package uninstall mismatch');
            }
            this.#ownedProvenance = undefined;
          }
        } else if (!observation.exact || !observation.reverseZero) {
          consecutiveZero = 0;
          zeroSince = null;
        } else {
          const observedAt = this.now();
          consecutiveZero += 1;
          zeroSince ??= observedAt;
          if (
            consecutiveZero >= 2
            && (
              !uncertain
              || observedAt - zeroSince
                >= cleanupPolicy.nullWindowMilliseconds
            )
          ) {
            const finalSerial = await this.#requireCurrentDevice(
              undefined,
              deadline,
            );
            const finalObservation = await readCleanupObservation(
              this.runner,
              finalSerial,
              { deadline, now: this.now },
            );
            requireDeadlineBudget(deadline, this.now);
            if (
              !finalObservation.exact
              || finalObservation.packageMaybePresent
              || finalObservation.processMaybePresent
              || !finalObservation.reverseZero
            ) {
              return Object.freeze({ status: 'mismatch' });
            }
            return Object.freeze({
              status: installSessionSettled ? 'match' : 'mismatch',
            });
          }
        }
      } catch {
        consecutiveZero = 0;
        zeroSince = null;
      }
      if (!hasDeadlineBudget(deadline, this.now)) break;
      try {
        await this.wait(remainingWait(
          deadline,
          this.now,
          cleanupPolicy.pollMilliseconds,
        ));
        requireDeadlineBudget(deadline, this.now);
      } catch {
        return Object.freeze({ status: 'mismatch' });
      }
    }
    return Object.freeze({ status: 'mismatch' });
  }

  #settleInstallSession(deadline) {
    if (this.#abandonFlight !== undefined) {
      return this.#abandonFlight;
    }
    if (
      this.#installSessionState === 'none'
      || this.#installSessionState === 'absent'
      || this.#installSessionState === 'abandoned'
      || this.#installSessionState === 'committed'
    ) {
      return Promise.resolve(Object.freeze({ status: 'match' }));
    }
    if (
      this.#installSessionState !== 'pending'
      || typeof this.#installSessionId !== 'string'
    ) {
      return Promise.resolve(Object.freeze({ status: 'mismatch' }));
    }
    const sessionId = this.#installSessionId;
    this.#abandonFlight = (async () => {
      try {
        const serial = await this.#requireCurrentDevice(
          undefined,
          deadline,
        );
        requireDeadlineBudget(deadline, this.now);
        const receipt = await this.runner.run(
          [
            '-s',
            serial,
            'shell',
            '-T',
            '-x',
            'cmd',
            'package',
            'install-abandon',
            sessionId,
          ],
          {
            timeoutMilliseconds: remainingTimeout(
              deadline,
              this.now,
              timeouts.uninstall,
            ),
          },
        );
        requireDeadlineBudget(deadline, this.now);
        if (exactSingleLine(receipt) !== 'Success') {
          return Object.freeze({ status: 'mismatch' });
        }
        this.#installSessionId = undefined;
        this.#installSessionState = 'abandoned';
        this.#installUncertain = false;
        return Object.freeze({ status: 'match' });
      } catch {
        return Object.freeze({ status: 'mismatch' });
      }
    })();
    return this.#abandonFlight;
  }

  async #requireCurrentDevice(signal, deadline) {
    const commandOptions = deadline === undefined
      ? { signal, timeoutMilliseconds: timeouts.inspect }
      : {
          signal,
          timeoutMilliseconds: remainingTimeout(
            deadline,
            this.now,
            timeouts.inspect,
          ),
        };
    const serial = await requireSingleDa5V5UsbDevice(
      this.runner,
      commandOptions,
    );
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    const model = exactSingleLine(await this.runner.run(
      ['-s', serial, 'shell', 'getprop', 'ro.product.model'],
      deadline === undefined
        ? commandOptions
        : {
            signal,
            timeoutMilliseconds: remainingTimeout(
              deadline,
              this.now,
              timeouts.inspect,
            ),
          },
    ));
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    const build = exactSingleLine(await this.runner.run(
      ['-s', serial, 'shell', 'getprop', 'ro.build.fingerprint'],
      deadline === undefined
        ? commandOptions
        : {
            signal,
            timeoutMilliseconds: remainingTimeout(
              deadline,
              this.now,
              timeouts.inspect,
            ),
          },
    ));
    if (
      model !== this.deviceBinding.deviceModel
      || build !== this.deviceBinding.androidBuild
      || this.serialBinding.bind(serial) !== 'match'
    ) {
      throw new Error('DA5 V5 Validation device binding mismatch');
    }
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    await requireOwnerUserTopology(
      this.runner,
      serial,
      signal,
      deadline === undefined
        ? undefined
        : { deadline, now: this.now },
    );
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    return this.serialBinding.use(serial, (retained) => retained);
  }
}

export class Da5V5ValidationPhase0Session {
  #abortController;
  #activeOperation;
  #adbToolIdentities;
  #device;
  #failureRequested = false;
  #finishDeadline;
  #finishFlight;
  #state = 'created';
  #terminalCommandAccepted = false;
  #operatorAbortRequested = false;

  constructor(options) {
    this.options = options;
    this.now = options.now ?? (() => performance.now());
    this.receipt = options.receipt ?? (() => {});
    this.done = new Promise((resolvePromise) => {
      this.resolveDone = resolvePromise;
    });
  }

  state() {
    return this.#state;
  }

  async start() {
    if (this.#state !== 'created') {
      return this.fail();
    }
    this.#state = 'preflighting';
    try {
      const inputs = requireDa5V5ValidationPhase0Inputs(this.options);
      const snapshot = (this.options.sealArtifact
        ?? verifyAndSealDa5V5ValidationPhase0Artifact)({
        androidSdkAuthority: inputs.androidSdkAuthority,
        inspectionTools: inputs.tools,
        profile: inputs.profile,
        toolIdentityDependencies:
          this.options.toolIdentityDependencies,
      });
      const adbRunnerTool = verifyDa5V5ValidationToolIdentity(
        inputs.tools.adb,
        this.options.toolIdentityDependencies,
      );
      const installStreamRunnerTool =
        verifyDa5V5ValidationToolIdentity(
          inputs.tools.adb,
          this.options.toolIdentityDependencies,
        );
      this.#adbToolIdentities = Object.freeze([
        adbRunnerTool,
        installStreamRunnerTool,
      ]);
      this.#device = new Da5V5ValidationPhase0Device({
        androidBuild: inputs.androidBuild,
        deviceModel: inputs.deviceModel,
        now: this.options.now,
        runner: this.options.runner
          ?? new SystemDa5V5AndroidAdbRunner({
            adbPath: adbRunnerTool.path,
          }),
        installStreamRunner: this.options.installStreamRunner
          ?? new SystemDa5V5ValidationInstallStreamRunner({
            adbPath: installStreamRunnerTool.path,
          }),
        serialBinding: this.options.serialBinding
          ?? new Da5V5UsbSerialBinding(),
        snapshot,
        wait: this.options.wait,
      });
      if (!this.#emitReceipt('artifact', 'match')) {
        return this.#finish(false);
      }
      this.#abortController = new AbortController();
      const preflight = this.#device.preflight({
        signal: this.#abortController.signal,
      });
      this.#activeOperation = preflight;
      try {
        await preflight;
      } finally {
        if (this.#activeOperation === preflight) {
          this.#activeOperation = undefined;
          this.#abortController = undefined;
        }
      }
      if (this.#failureRequested) {
        return this.#finish(false);
      }
      this.#state = 'ready';
      if (!this.#emitReceipt('preflight', 'match')) {
        return this.fail();
      }
      return Object.freeze({ status: 'match' });
    } catch {
      this.#emitReceipt(
        this.#device === undefined ? 'artifact' : 'preflight',
        'mismatch',
      );
      return this.fail();
    }
  }

  submit(command) {
    if (this.#finishFlight !== undefined) {
      if (this.#state === 'complete' || this.#state === 'failed') {
        return Promise.resolve(Object.freeze({ status: 'mismatch' }));
      }
      if (this.#terminalCommandAccepted) {
        return this.#finishFlight;
      }
      this.#failureRequested = true;
      return this.#finishFlight;
    }
    if (
      command === 'abort'
      && this.#state !== 'complete'
      && this.#state !== 'failed'
    ) {
      this.#terminalCommandAccepted = true;
      this.#operatorAbortRequested = true;
      return this.fail();
    }
    if (this.#activeOperation !== undefined) {
      this.#operatorAbortRequested = true;
      return this.fail();
    }
    if (command === 'install-launch' && this.#state === 'ready') {
      this.#state = 'installing';
      this.#abortController = new AbortController();
      const operation = this.#device.installAndLaunch({
        operatorAbortRequested: () => this.#operatorAbortRequested,
        signal: this.#abortController.signal,
      });
      this.#activeOperation = operation;
      operation.then(
        () => {
          if (this.#activeOperation === operation) {
            this.#activeOperation = undefined;
            this.#abortController = undefined;
          }
          if (!this.#failureRequested) {
            this.#state = 'waiting';
            if (
              !this.#emitReceipt('install_launch', 'match')
              || !this.#emitReceipt('waiting', 'match')
            ) {
              void this.fail();
            }
          }
        },
        (error) => {
          if (this.#activeOperation === operation) {
            this.#activeOperation = undefined;
            this.#abortController = undefined;
          }
          const diagnostic =
            requireDa5V5ValidationInstallLaunchFailure(error);
          this.#emitReceipt(
            diagnostic.stage,
            'mismatch',
            diagnostic.category,
          );
          this.#emitReceipt('install_launch', 'mismatch');
          void this.fail();
        },
      );
      return operation.catch(() => undefined);
    }
    if (command === 'human-pass' && this.#state === 'waiting') {
      this.#state = 'human_passed';
      if (!this.#emitReceipt('human_pass', 'match')) {
        return this.fail();
      }
      return Promise.resolve(Object.freeze({ status: 'match' }));
    }
    if (command === 'cleanup' && this.#state === 'human_passed') {
      this.#terminalCommandAccepted = true;
      return this.#finish(true);
    }
    return this.fail();
  }

  end() {
    if (this.#terminalCommandAccepted && this.#finishFlight !== undefined) {
      return this.#finishFlight;
    }
    if (this.#state === 'complete' || this.#state === 'failed') {
      return this.done;
    }
    if (this.#activeOperation !== undefined) {
      this.#operatorAbortRequested = true;
    }
    return this.fail();
  }

  signal() {
    this.#operatorAbortRequested = true;
    return this.fail();
  }

  fail() {
    this.#failureRequested = true;
    return this.#finish(false);
  }

  #emitReceipt(stage, status, category) {
    try {
      this.receipt(stage, status, category);
      return true;
    } catch {
      this.#failureRequested = true;
      return false;
    }
  }

  #finish(successRequested) {
    if (this.#finishFlight !== undefined) {
      if (!successRequested) this.#failureRequested = true;
      return this.#finishFlight;
    }
    const active = this.#activeOperation;
    this.#finishDeadline = this.now() + (
      this.#device?.finishMaximumMilliseconds()
      ?? cleanupPolicy.knownMaximumMilliseconds
    );
    this.#abortController?.abort();
    this.#state = 'cleaning';
    this.#finishFlight = (async () => {
      if (active !== undefined) {
        try {
          const settled = await settleBeforeDeadline(
            active,
            this.#finishDeadline,
            this.now,
          );
          if (!settled) this.#failureRequested = true;
        } catch {
          this.#failureRequested = true;
        }
      }
      if (!hasDeadlineBudget(this.#finishDeadline, this.now)) {
        this.#failureRequested = true;
      }
      let cleanup;
      try {
        cleanup = this.#device === undefined
          ? (
              hasDeadlineBudget(this.#finishDeadline, this.now)
                ? Object.freeze({ status: 'match' })
                : Object.freeze({ status: 'mismatch' })
            )
          : await this.#device.cleanup({
              deadline: this.#finishDeadline,
            });
      } catch {
        cleanup = Object.freeze({ status: 'mismatch' });
      }
      if (
        cleanup.status === 'match'
        && !hasDeadlineBudget(this.#finishDeadline, this.now)
      ) {
        cleanup = Object.freeze({ status: 'mismatch' });
      }
      if (
        cleanup.status === 'match'
        && this.#adbToolIdentities !== undefined
      ) {
        try {
          for (const identity of this.#adbToolIdentities) {
            assertDa5V5ValidationToolIdentityMetadata(
              identity,
              this.options.toolIdentityDependencies,
            );
          }
        } catch {
          cleanup = Object.freeze({ status: 'mismatch' });
        }
      }
      this.#emitReceipt('cleanup', cleanup.status);
      let success = (
        successRequested
        && !this.#failureRequested
        && cleanup.status === 'match'
        && hasDeadlineBudget(this.#finishDeadline, this.now)
      );
      if (success && !this.#emitReceipt('complete', 'match')) {
        success = false;
      }
      this.#state = success ? 'complete' : 'failed';
      if (!success) {
        this.#emitReceipt('failed', 'mismatch');
      }
      const result = Object.freeze({
        status: success ? 'match' : 'mismatch',
      });
      this.resolveDone(result);
      return result;
    })();
    return this.#finishFlight;
  }
}

export function createDa5V5ValidationPhase0Session(options) {
  return new Da5V5ValidationPhase0Session(options);
}

class Da5V5ValidationInstallLaunchFailure extends Error {
  constructor(stage, category) {
    super('DA5 V5 Validation install-launch diagnostic mismatch');
    this.category = category;
    this.stage = stage;
  }
}

function requireDa5V5ValidationInstallLaunchFailure(error) {
  if (
    !(error instanceof Da5V5ValidationInstallLaunchFailure)
    || !Object.values(
      DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES,
    ).includes(error.stage)
    || !Object.values(
      DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES,
    ).includes(error.category)
  ) {
    return Object.freeze({
      category:
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES.operationMismatch,
      stage:
        DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES.installation,
    });
  }
  return Object.freeze({
    category: error.category,
    stage: error.stage,
  });
}

async function requirePackageProcessReverseZero(runner, serial, signal) {
  if (
    await readOwnerPackageRegistration(runner, serial, { signal })
    !== 'absent'
  ) {
    throw new Error('DA5 V5 Validation package preinstall mismatch');
  }
  if ((await readMatchingProcesses(runner, serial, signal)).length !== 0) {
    throw new Error('DA5 V5 Validation process preinstall mismatch');
  }
  await requireReverseZero(runner, serial, signal);
}

async function readMatchingProcesses(runner, serial, signal, budget) {
  const value = await runner.run(
    [
      '-s', serial, 'shell', 'ps', '-A', '-w', '-o', 'NAME:4',
    ],
    commandOptions(budget, timeouts.inspect, signal),
  );
  const lines = exactLines(value);
  if (lines.shift() !== 'NAME') {
    throw new Error('DA5 V5 Validation process header mismatch');
  }
  for (const line of lines) {
    if (line.length === 0 || /\s|\0/u.test(line)) {
      throw new Error('DA5 V5 Validation process state mismatch');
    }
  }
  return lines.filter((line) => (
    line === DA5_V5_VALIDATION_PACKAGE
    || line.startsWith(`${DA5_V5_VALIDATION_PACKAGE}:`)
  ));
}

async function requireReverseZero(runner, serial, signal) {
  const value = await runner.run(
    ['-s', serial, 'reverse', '--list'],
    { signal, timeoutMilliseconds: timeouts.inspect },
  );
  if (!isExactEmptyOutput(value)) {
    throw new Error('DA5 V5 Validation global reverse state mismatch');
  }
}

async function readCleanupObservation(runner, serial, budget) {
  let exact = true;
  let packagePresent = false;
  let packageMaybePresent = false;
  let processMaybePresent = false;
  try {
    const packageRegistration = await readOwnerPackageRegistration(
      runner,
      serial,
      budget,
    );
    if (packageRegistration === 'present') {
      packagePresent = true;
      packageMaybePresent = true;
    }
  } catch {
    exact = false;
    packageMaybePresent = true;
  }
  try {
    processMaybePresent =
      (await readMatchingProcesses(
        runner,
        serial,
        undefined,
        budget,
      )).length !== 0;
  } catch {
    exact = false;
    processMaybePresent = true;
  }
  let reverseZero = false;
  try {
    const reverseOutput = await runner.run(
      ['-s', serial, 'reverse', '--list'],
      commandOptions(budget, timeouts.inspect),
    );
    reverseZero = isExactEmptyOutput(reverseOutput);
  } catch {
    exact = false;
  }
  return Object.freeze({
    exact,
    packageMaybePresent,
    packagePresent,
    processMaybePresent,
    reverseZero,
  });
}

async function readInstalledPackagePath(
  runner,
  serial,
  signal,
  budget,
) {
  return parseDa5V5ValidationInstalledBaseApkPath(
    await runner.run(
      [
        '-s', serial, 'shell', 'cmd', 'package', 'path',
        '--user', androidOwnerUser, DA5_V5_VALIDATION_PACKAGE,
      ],
      commandOptions(budget, timeouts.inspect, signal),
    ),
  );
}

async function readInstalledCanonical(
  runner,
  serial,
  path,
  signal,
  budget,
) {
  return exactSingleLine(await runner.run(
    ['-s', serial, 'shell', 'readlink', '-f', '--', path],
    commandOptions(budget, timeouts.inspect, signal),
  ));
}

async function readInstalledStat(
  runner,
  serial,
  path,
  signal,
  budget,
) {
  return parseDa5V5ValidationInstalledStat(await runner.run(
    ['-s', serial, 'shell', 'stat', '-c', '%d:%i:%s:%f', '--', path],
    commandOptions(budget, timeouts.inspect, signal),
  ));
}

async function readOwnerPackageRegistration(
  runner,
  serial,
  budget = {},
) {
  const value = await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'package', 'list', 'packages',
      '-a', '-u', '--user', androidOwnerUser,
      DA5_V5_VALIDATION_PACKAGE,
    ],
    commandOptions(budget, timeouts.inspect, budget.signal),
  );
  if (isExactEmptyOutput(value)) return 'absent';
  if (
    exactSingleLine(value)
    === `package:${DA5_V5_VALIDATION_PACKAGE}`
  ) {
    return 'present';
  }
  throw new Error('DA5 V5 Validation package registration mismatch');
}

async function requireOwnerPackagePresent(runner, serial, signal, budget) {
  if (
    await readOwnerPackageRegistration(
      runner,
      serial,
      budget === undefined ? { signal } : { ...budget, signal },
    ) !== 'present'
  ) {
    throw new Error('DA5 V5 Validation installed package mismatch');
  }
}

async function requireOwnerInstalledVersion(
  runner,
  serial,
  signal,
  budget,
) {
  const value = exactSingleLine(await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'package', 'list', 'packages',
      '--show-versioncode', '--user', androidOwnerUser,
      DA5_V5_VALIDATION_PACKAGE,
    ],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  if (
    value
    !== `package:${DA5_V5_VALIDATION_PACKAGE} versionCode:${validationVersionCode}`
  ) {
    throw new Error('DA5 V5 Validation installed version mismatch');
  }
}

async function requireOwnerUserTopology(
  runner,
  serial,
  signal,
  budget,
) {
  parseDa5V5ValidationAndroidUserTopology(await runner.run(
    ['-s', serial, 'shell', 'cmd', 'user', 'list', '--all'],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  requireDeadlineBudgetIfPresent(budget);
  const mainUser = exactSingleLine(await runner.run(
    ['-s', serial, 'shell', 'cmd', 'user', 'get-main-user'],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  requireDeadlineBudgetIfPresent(budget);
  const headlessMode = exactSingleLine(await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'user',
      'is-headless-system-user-mode',
    ],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  requireDeadlineBudgetIfPresent(budget);
  const currentUser = exactSingleLine(await runner.run(
    ['-s', serial, 'shell', 'am', 'get-current-user'],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  if (
    mainUser !== androidOwnerUser
    || headlessMode !== 'false'
    || currentUser !== androidOwnerUser
  ) {
    throw new Error('DA5 V5 Validation Android user topology mismatch');
  }
}

async function requireOwnedProvenance(
  runner,
  serial,
  provenance,
  options = {},
) {
  if (
    provenance?.status !== 'match'
    || provenance.versionCode !== validationVersionCode
    || provenance.sha256
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256
  ) {
    throw new Error('DA5 V5 Validation package provenance mismatch');
  }
  const budget = options.deadline === undefined
    ? undefined
    : { deadline: options.deadline, now: options.now };
  await requireOwnerUserTopology(
    runner,
    serial,
    options.signal,
    budget,
  );
  await requireOwnerPackagePresent(
    runner,
    serial,
    options.signal,
    budget,
  );
  await requireOwnerInstalledVersion(
    runner,
    serial,
    options.signal,
    budget,
  );
  const path = await readInstalledPackagePath(
    runner,
    serial,
    options.signal,
    budget,
  );
  const canonicalPath = await readInstalledCanonical(
    runner,
    serial,
    path,
    options.signal,
    budget,
  );
  const stat = await readInstalledStat(
    runner,
    serial,
    path,
    options.signal,
    budget,
  );
  if (
    path !== provenance.path
    || canonicalPath !== provenance.canonicalPath
    || JSON.stringify(stat) !== JSON.stringify(provenance.stat)
  ) {
    throw new Error('DA5 V5 Validation package provenance changed');
  }
  return Object.freeze({ status: 'match' });
}

function requireExactLaunchReceipt(value) {
  const lines = exactLines(value);
  const statuses = lines.filter((line) => line.startsWith('Status:'));
  const activities = lines.filter((line) => line.startsWith('Activity:'));
  if (
    statuses.length !== 1
    || statuses[0] !== 'Status: ok'
    || activities.length !== 1
    || activities[0] !== `Activity: ${DA5_V5_VALIDATION_PHASE0_ACTIVITY}`
  ) {
    throw new Error('DA5 V5 Validation explicit launch mismatch');
  }
}

function requireStableHostFile(binding, fileDescriptor, files) {
  const opened = files.fstat(fileDescriptor);
  const atPath = files.lstat(binding.path);
  if (
    !opened.isFile()
    || opened.isSymbolicLink()
    || !atPath.isFile()
    || atPath.isSymbolicLink()
    || opened.size !== binding.bytes
    || atPath.size !== binding.bytes
    || (opened.mode & 0o7777) !== binding.mode
    || (atPath.mode & 0o7777) !== binding.mode
    || !Number.isSafeInteger(opened.dev)
    || !Number.isSafeInteger(opened.ino)
    || opened.dev !== atPath.dev
    || opened.ino !== atPath.ino
    || normalize(files.realpath(binding.path)) !== binding.path
  ) {
    throw new Error('DA5 V5 Validation stable snapshot metadata mismatch');
  }
  return Object.freeze({ dev: opened.dev, ino: opened.ino });
}

function requireHostBinding(binding) {
  if (
    typeof binding?.path !== 'string'
    || normalize(resolve(binding.path)) !== binding.path
    || !Number.isSafeInteger(binding.bytes)
    || binding.bytes <= 0
    || !Number.isSafeInteger(binding.mode)
    || !/^[0-9a-f]{64}$/u.test(binding.sha256)
  ) {
    throw new Error('DA5 V5 Validation stable snapshot binding mismatch');
  }
}

function systemStableFileDependencies() {
  return Object.freeze({
    close: closeSync,
    fstat: fstatSync,
    lstat: lstatSync,
    openReadOnly(path) {
      return openSync(
        path,
        fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
      );
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
            throw new Error('DA5 V5 Validation stable snapshot short read');
          }
          offset += bytesRead;
        }
        if (readSync(fileDescriptor, excess, 0, 1, offset) !== 0) {
          throw new Error('DA5 V5 Validation stable snapshot long read');
        }
        return snapshot;
      } catch (error) {
        snapshot.fill(0);
        throw error;
      } finally {
        excess.fill(0);
      }
    },
    realpath: realpathSync,
  });
}

function isBoundInput(value) {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isSafePathSegment(value) {
  return value !== '.' && value !== '..' && safeSegmentPattern.test(value);
}

function exactSingleLine(value) {
  if (typeof value !== 'string') {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  const match = /^([^\0\r\n]+)(?:\r?\n)?$/u.exec(value);
  if (match?.[1] === undefined) {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  return match[1];
}

function parsePackageManagerCreateReceipt(value) {
  const generic =
    DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerReceiptMismatch;
  let line;
  try {
    line = exactSingleLine(value);
  } catch {
    return Object.freeze({
      category: generic,
      sessionAbsent: false,
      status: 'mismatch',
    });
  }
  const created =
    /^Success: created install session \[([1-9][0-9]{0,9})\]$/u
      .exec(line);
  if (created?.[1] !== undefined) {
    const sessionId = Number(created[1]);
    if (
      Number.isSafeInteger(sessionId)
      && sessionId <= maximumPackageInstallerSessionId
    ) {
      return Object.freeze({
        sessionId: created[1],
        status: 'match',
      });
    }
  }
  return Object.freeze({
    category: classifyPackageManagerInstallReceipt(line),
    sessionAbsent: isExactPackageManagerNonSuccessLine(line),
    status: 'mismatch',
  });
}

function classifyPackageManagerWriteReceipt(
  value,
  stdinTerminal,
  expectedBytes,
) {
  const partial = stdinTerminal === 'partial_then_pipe_closed';
  let line;
  try {
    line = exactSingleLine(value);
  } catch {
    return partial
      ? DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
        .adbStdinPipeAbortMismatch
      : DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
        .packageManagerReceiptMismatch;
  }
  if (
    !partial
    && line === `Success: streamed ${expectedBytes} bytes`
  ) {
    return null;
  }
  if (partial && !isExactPackageManagerNonSuccessLine(line)) {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .adbStdinPipeAbortMismatch;
  }
  return classifyPackageManagerInstallReceipt(line);
}

function classifyPackageManagerInstallReceipt(value) {
  const generic =
    DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerReceiptMismatch;
  let line;
  try {
    line = exactSingleLine(value);
  } catch {
    return generic;
  }
  if (line === 'Success') {
    return null;
  }
  if (line.length > 2_048) {
    return generic;
  }
  if (
    line === 'Error: must either specify a package size or an APK file'
    || /^Error: Unknown option(?::)? -{1,2}[A-Za-z][A-Za-z0-9-]*$/u
      .test(line)
  ) {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerCommandContractMismatch;
  }
  if (/^Failure \[user (?:0|[1-9][0-9]*) doesn't exist\]$/u.test(line)) {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerPolicyRestriction;
  }
  const failure = packageManagerFailureReceiptPattern.exec(line);
  const code = failure?.[1];
  if (code === undefined) {
    return generic;
  }
  if (code === 'INSTALL_FAILED_USER_RESTRICTED') {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerPolicyRestriction;
  }
  if (packageManagerArtifactRejections.includes(code)) {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerArtifactRejection;
  }
  if (packageManagerInstalledStateConflicts.includes(code)) {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerInstalledStateConflict;
  }
  if (packageManagerStorageRejections.includes(code)) {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerStorageRejection;
  }
  if (code === 'INSTALL_FAILED_SESSION_INVALID') {
    return DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
      .packageManagerCommandContractMismatch;
  }
  return generic;
}

function isExactPackageManagerNonSuccessLine(line) {
  return (
    line === 'Error: must either specify a package size or an APK file'
    || /^Error: Unknown option(?::)? -{1,2}[A-Za-z][A-Za-z0-9-]*$/u
      .test(line)
    || /^Failure \[user (?:0|[1-9][0-9]*) doesn't exist\]$/u
      .test(line)
    || packageManagerFailureReceiptPattern.test(line)
  );
}

function exactLines(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  const normalized = value.endsWith('\r\n')
    ? value.slice(0, -2)
    : value.endsWith('\n')
      ? value.slice(0, -1)
      : value;
  if (normalized.length === 0) return [];
  const lines = normalized.split(/\r?\n/u);
  if (lines.some((line) => line.length === 0)) {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  return lines;
}

function isExactEmptyOutput(value) {
  return value === '' || value === '\n' || value === '\r\n';
}

function commandOptions(budget, maximumMilliseconds, signal) {
  if (budget?.deadline !== undefined) {
    return {
      signal,
      timeoutMilliseconds: remainingTimeout(
        budget.deadline,
        budget.now,
        maximumMilliseconds,
      ),
    };
  }
  return {
    signal: signal ?? budget?.signal,
    timeoutMilliseconds: maximumMilliseconds,
  };
}

function hasDeadlineBudget(deadline, now) {
  return isDeadline(deadline) && now() < deadline;
}

function isDeadline(value) {
  return Number.isFinite(value) && value >= 0;
}

function remainingTimeout(deadline, now, maximumMilliseconds) {
  const remaining = Math.floor(deadline - now());
  if (remaining < 2_001) {
    throw new Error('DA5 V5 Validation cleanup deadline exhausted');
  }
  return Math.min(maximumMilliseconds, remaining);
}

function remainingInstallTimeout(deadline, now, maximumMilliseconds) {
  const remaining = Math.floor(deadline - now());
  if (remaining < 2_001) {
    throw new Da5V5AndroidCommandTimeoutError();
  }
  return Math.min(maximumMilliseconds, remaining);
}

function remainingWait(deadline, now, maximumMilliseconds) {
  const remaining = Math.floor(deadline - now());
  if (remaining <= 0) {
    throw new Error('DA5 V5 Validation cleanup deadline exhausted');
  }
  return Math.min(maximumMilliseconds, remaining);
}

function requireDeadlineBudget(deadline, now) {
  if (!hasDeadlineBudget(deadline, now)) {
    throw new Error('DA5 V5 Validation cleanup deadline exhausted');
  }
}

function requireDeadlineBudgetIfPresent(budget) {
  if (budget?.deadline !== undefined) {
    requireDeadlineBudget(budget.deadline, budget.now);
  }
}

async function settleBeforeDeadline(operation, deadline, now) {
  const remaining = deadline - now();
  if (remaining <= 0) return false;
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolvePromise(false);
      }
    }, remaining);
    operation.then(
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolvePromise(now() < deadline);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          rejectPromise(error);
        }
      },
    );
  });
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
